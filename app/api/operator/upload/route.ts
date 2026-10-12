import { requireStaff } from "@/lib/operator/auth";
import { db, must } from "@/lib/db/client";
import { ingestDocument } from "@/lib/ingest/ingest";
import { csvToMarkdown, textToMarkdown } from "@/lib/ingest/normalize";
import { imageToMarkdown, pdfToMarkdown } from "@/lib/integrations/google";
import { audit } from "@/lib/operator/manualSource";

const MAX = 4 * 1024 * 1024;

/** Manual upload: PDF, image, text, Markdown or CSV, up to 4 MB, through the same ingest and Privacy Guard. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "That file is over 4 MB. Split it, or connect it from Google Drive." }, { status: 413 });
  const title = file.name.replace(/\.[a-z0-9]+$/i, "");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = file.type || "";
  let markdown: string | null = null;
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) markdown = await pdfToMarkdown(title, bytes);
  else if (/^image\//.test(type)) {
    markdown = await imageToMarkdown(title, bytes, type);
    if (!markdown) return Response.json({ error: "Reading text from images needs AI turned on. Upload a PDF or text file instead." }, { status: 422 });
  } else if (type === "text/csv" || /\.csv$/i.test(file.name)) markdown = csvToMarkdown(title, new TextDecoder().decode(bytes));
  else if (/^text\//.test(type) || /\.(md|txt)$/i.test(file.name)) {
    const t = new TextDecoder().decode(bytes);
    markdown = /\.md$/i.test(file.name) ? t : textToMarkdown(title, t);
  } else return Response.json({ error: "Upload a PDF, image, text, Markdown or CSV file." }, { status: 415 });
  if (!markdown.replace(/[#\s]/g, "").length) return Response.json({ error: "We couldn't find any text in that file. If it's a scan, try a photo or connect AI." }, { status: 422 });

  const { session } = auth;
  let src = (await db().from("sources").select("id").eq("school_id", session.schoolId).eq("kind", "upload").maybeSingle()).data;
  if (!src) src = must(await db().from("sources").insert({ school_id: session.schoolId, kind: "upload", name: "Uploads", account_label: "Uploaded files", status: "connected", last_synced_at: new Date().toISOString() }).select("id").single(), "upload source");
  const r = await ingestDocument({ schoolId: session.schoolId, sourceId: src.id, externalId: `upload:${file.name}`, title, content: markdown, emoji: type.includes("pdf") ? "📕" : type.startsWith("image/") ? "🖼️" : "📄", mime: type || "text/plain", authoredBy: session.personId, sourceUpdatedAt: new Date().toISOString() });
  await db().from("sources").update({ last_synced_at: new Date().toISOString() }).eq("id", src.id);
  await audit(session.schoolId, session.personId, "source.upload", { title, documentId: r.documentId, held: r.newlyHeld, visibility: r.visibility });
  return Response.json({ ok: true, documentId: r.documentId, visibility: r.visibility, findings: r.findings, held: r.newlyHeld, chunks: r.chunks });
}
