import "server-only";
import { Client } from "@notionhq/client";
import { config } from "@/lib/config";

/**
 * Notion: a public OAuth integration. The director picks which pages to
 * share in Notion's own consent screen (least privilege by design); we read
 * those pages and their children, turn blocks into Markdown, and ingest.
 */

export function notionConfigured() {
  return Boolean(config.integrations.notion.clientId && config.integrations.notion.clientSecret);
}

export function notionAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: config.integrations.notion.clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: `${config.appUrl}/api/integrations/notion/callback`,
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${p.toString()}`;
}

export async function exchangeNotionCode(code: string): Promise<{ accessToken: string; workspaceName: string | null; workspaceId: string }> {
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`${config.integrations.notion.clientId}:${config.integrations.notion.clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: `${config.appUrl}/api/integrations/notion/callback` }),
  });
  const j = (await res.json()) as { access_token?: string; workspace_name?: string; workspace_id?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`notion token exchange failed: ${j.error ?? res.status}`);
  return { accessToken: j.access_token, workspaceName: j.workspace_name ?? null, workspaceId: j.workspace_id ?? "" };
}

type RichText = Array<{ plain_text: string; annotations?: { bold?: boolean; italic?: boolean; code?: boolean }; href?: string | null }>;
type AnyBlock = Record<string, unknown> & { id: string; type: string; has_children?: boolean };

function rt(text: RichText | undefined): string {
  return (text ?? [])
    .map((t) => {
      let s = t.plain_text;
      if (!s.trim()) return s;
      if (t.annotations?.code) s = `\`${s}\``;
      if (t.annotations?.bold) s = `**${s}**`;
      if (t.annotations?.italic) s = `*${s}*`;
      return s;
    })
    .join("");
}

async function children(client: Client, id: string): Promise<AnyBlock[]> {
  const out: AnyBlock[] = [];
  let cursor: string | undefined;
  do {
    const r = (await client.blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 })) as unknown as { results: AnyBlock[]; next_cursor: string | null; has_more: boolean };
    out.push(...r.results);
    cursor = r.has_more ? (r.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/** Notion blocks to Markdown: headings, paragraphs, lists, to-dos, toggles, callouts, quotes, tables, dividers. */
export async function blocksToMarkdown(client: Client, blockId: string, depth = 0): Promise<string> {
  if (depth > 3) return "";
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const b of await children(client, blockId)) {
    const data = (b[b.type] ?? {}) as { rich_text?: RichText; checked?: boolean; icon?: { emoji?: string }; table_width?: number; cells?: RichText[] };
    const text = rt(data.rich_text);
    switch (b.type) {
      case "heading_1":
        lines.push(`\n# ${text}\n`);
        break;
      case "heading_2":
        lines.push(`\n## ${text}\n`);
        break;
      case "heading_3":
        lines.push(`\n### ${text}\n`);
        break;
      case "paragraph":
        lines.push(text ? `${indent}${text}\n` : "");
        break;
      case "bulleted_list_item":
      case "toggle":
        lines.push(`${indent}- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`${indent}1. ${text}`);
        break;
      case "to_do":
        lines.push(`${indent}- [${data.checked ? "x" : " "}] ${text}`);
        break;
      case "quote":
        lines.push(`> ${text}\n`);
        break;
      case "callout":
        lines.push(`> ${data.icon?.emoji ?? ""} ${text}\n`);
        break;
      case "divider":
        lines.push("\n---\n");
        break;
      case "table": {
        const rows = await children(client, b.id);
        rows.forEach((row, i) => {
          const cells = ((row.table_row as { cells?: RichText[] })?.cells ?? []).map((c) => rt(c).replace(/\|/g, "\\|"));
          lines.push(`| ${cells.join(" | ")} |`);
          if (i === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        });
        lines.push("");
        continue;
      }
      case "child_page":
      case "child_database":
        // Child pages are synced as their own documents.
        continue;
      default:
        if (text) lines.push(`${indent}${text}`);
    }
    if (b.has_children && b.type !== "table") lines.push(await blocksToMarkdown(client, b.id, depth + 1));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface NotionPage {
  id: string;
  title: string;
  emoji: string | null;
  url: string;
  parentId: string | null;
  lastEdited: string;
}

function pageTitle(p: Record<string, unknown>): string {
  const props = (p.properties ?? {}) as Record<string, { type: string; title?: RichText }>;
  const t = Object.values(props).find((x) => x.type === "title");
  return rt(t?.title).replace(/\*\*/g, "") || "Untitled";
}

export async function listSharedPages(client: Client, limit = 150): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const r = (await client.search({ filter: { property: "object", value: "page" }, start_cursor: cursor, page_size: 100 } as never)) as unknown as {
      results: Array<Record<string, unknown>>;
      next_cursor: string | null;
      has_more: boolean;
    };
    for (const p of r.results) {
      if (p.object !== "page" || p.in_trash || p.archived) continue;
      const parent = p.parent as { type: string; page_id?: string } | undefined;
      out.push({
        id: String(p.id),
        title: pageTitle(p),
        emoji: (p.icon as { type?: string; emoji?: string } | null)?.type === "emoji" ? ((p.icon as { emoji: string }).emoji ?? null) : null,
        url: String(p.url),
        parentId: parent?.type === "page_id" ? (parent.page_id ?? null) : null,
        lastEdited: String(p.last_edited_time),
      });
    }
    cursor = r.has_more ? (r.next_cursor ?? undefined) : undefined;
  } while (cursor && out.length < limit);
  return out;
}

export function notionClient(token: string) {
  return new Client({ auth: token });
}
