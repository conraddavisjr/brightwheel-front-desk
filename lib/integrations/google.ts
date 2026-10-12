import "server-only";
import { generateText } from "ai";
import { config } from "@/lib/config";
import { canCallModel, gemini, meter } from "@/lib/ai/provider";
import { csvToMarkdown, textToMarkdown } from "@/lib/ingest/normalize";

/**
 * Google Drive and Calendar over plain REST (no 2 MB SDK on the server path).
 *
 * Drive uses the drive.file scope plus the Google Picker: the director picks
 * the files, and we can read only those. It is Google's least-privilege
 * scope and needs no restricted-scope verification. Calendar uses
 * calendar.readonly, which is sensitive, so the app stays in testing mode
 * with named test users; schools without that can paste a public iCal link.
 */

export const SCOPES = {
  drive: ["https://www.googleapis.com/auth/drive.file"],
  calendar: ["https://www.googleapis.com/auth/calendar.readonly"],
} as const;

export function googleConfigured() {
  return Boolean(config.integrations.google.clientId && config.integrations.google.clientSecret);
}

const redirectUri = () => `${config.appUrl}/api/integrations/google/callback`;

export function googleAuthorizeUrl(state: string, product: "drive" | "calendar"): string {
  const p = new URLSearchParams({
    client_id: config.integrations.google.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ["openid", "email", ...SCOPES[product]].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; accessToken: string; email: string | null }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.integrations.google.clientId, client_secret: config.integrations.google.clientSecret, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  const j = (await res.json()) as { refresh_token?: string; access_token?: string; id_token?: string; error?: string };
  if (!res.ok || !j.access_token || !j.refresh_token) throw new Error(`google token exchange failed: ${j.error ?? res.status}`);
  let email: string | null = null;
  if (j.id_token) {
    try {
      email = JSON.parse(Buffer.from(j.id_token.split(".")[1], "base64url").toString("utf8")).email ?? null;
    } catch {
      email = null;
    }
  }
  return { refreshToken: j.refresh_token, accessToken: j.access_token, email };
}

export async function googleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: config.integrations.google.clientId, client_secret: config.integrations.google.clientSecret, grant_type: "refresh_token" }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`google refresh failed: ${j.error ?? res.status}`);
  return j.access_token;
}

async function g(token: string, url: string): Promise<Response> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`google ${res.status} ${url.split("?")[0]}`);
  return res;
}

export interface DriveDoc {
  id: string;
  title: string;
  mime: string;
  markdown: string;
  url: string;
  modified: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Read one picked Drive file as Markdown: Docs, Sheets, PDFs, text, and images (OCR with AI on). */
export async function readDriveFile(token: string, fileId: string): Promise<DriveDoc | null> {
  const meta = (await (await g(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink,size`)).json()) as { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string; size?: string };
  if (Number(meta.size ?? 0) > MAX_BYTES) return null;
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  let markdown: string | null = null;
  const title = meta.name.replace(/\.(pdf|docx?|md|txt|csv|png|jpe?g)$/i, "");
  if (meta.mimeType === "application/vnd.google-apps.document") {
    markdown = await (await g(token, `${base}/export?mimeType=${encodeURIComponent("text/markdown")}`)).text();
  } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
    markdown = csvToMarkdown(title, await (await g(token, `${base}/export?mimeType=text/csv`)).text());
  } else if (meta.mimeType === "application/pdf") {
    markdown = await pdfToMarkdown(title, new Uint8Array(await (await g(token, `${base}?alt=media`)).arrayBuffer()));
  } else if (/^text\//.test(meta.mimeType)) {
    const t = await (await g(token, `${base}?alt=media`)).text();
    markdown = meta.mimeType === "text/csv" ? csvToMarkdown(title, t) : meta.mimeType === "text/markdown" ? t : textToMarkdown(title, t);
  } else if (/^image\//.test(meta.mimeType)) {
    markdown = await imageToMarkdown(title, new Uint8Array(await (await g(token, `${base}?alt=media`)).arrayBuffer()), meta.mimeType);
  }
  if (!markdown) return null;
  return { id: meta.id, title, mime: meta.mimeType, markdown, url: meta.webViewLink, modified: meta.modifiedTime };
}

export async function pdfToMarkdown(title: string, bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return textToMarkdown(title, pages.join("\n\n"));
}

/** Photos of a flyer or a scanned page: Gemini reads the text (only with AI on; otherwise we say so). */
export async function imageToMarkdown(title: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  if (!(await canCallModel())) return null;
  const { text, usage } = await generateText({
    model: gemini()(config.ai.classifierModel),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe all text in this image as clean Markdown (headings, lists, tables). Do not add anything that is not in the image." },
          { type: "file", data: bytes, mediaType: mime },
        ],
      },
    ],
  });
  await meter("ocr", usage.inputTokens ?? 0, usage.outputTokens ?? 0);
  return `# ${title}\n\n${text}`;
}

export interface CalEventIn {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  private: boolean;
}

export async function listCalendars(token: string): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const j = (await (await g(token, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader")).json()) as { items: Array<{ id: string; summary: string; primary?: boolean }> };
  return j.items.map((c) => ({ id: c.id, summary: c.summary, primary: Boolean(c.primary) }));
}

export async function listCalendarEvents(token: string, calendarId: string, tz: string): Promise<CalEventIn[]> {
  const p = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "250", timeMin: new Date(Date.now() - 30 * 86400000).toISOString(), timeMax: new Date(Date.now() + 365 * 86400000).toISOString() });
  const j = (await (await g(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${p.toString()}`)).json()) as {
    items: Array<{ id: string; summary?: string; start: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; location?: string; description?: string; visibility?: string; status?: string }>;
  };
  const { zonedMidnight } = await import("@/lib/time");
  return j.items
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      title: e.summary ?? "(no title)",
      allDay: Boolean(e.start.date),
      startsAt: e.start.dateTime ?? zonedMidnight(e.start.date!, tz).toISOString(),
      endsAt: e.end?.dateTime ?? (e.end?.date ? zonedMidnight(e.end.date, tz).toISOString() : null),
      location: e.location ?? null,
      description: e.description?.replace(/<[^>]+>/g, " ").trim() ?? null,
      private: e.visibility === "private" || e.visibility === "confidential",
    }));
}
