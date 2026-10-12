/**
 * Everything becomes Markdown before ingest: one format for the chunker,
 * the detectors and the Knowledge editor. Small, dependency-free parsers.
 */

export function parseFrontmatter(src: string): { meta: Record<string, string | null>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, string | null> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim().replace(/^["']|["']$/g, "");
    meta[kv[1]] = v === "null" || v === "" ? null : v;
  }
  return { meta, body: src.slice(m[0].length) };
}

/** RFC 4180-ish CSV: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
const humanize = (h: string) => h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** A sheet becomes a Markdown table under the sheet's title, so a row stays one fact. */
export function csvToMarkdown(title: string, csv: string): string {
  const rows = parseCsv(csv);
  if (rows.length === 0) return `# ${title}\n`;
  const [header, ...body] = rows;
  const width = header.length;
  const lines = [
    `# ${title}`,
    "",
    `| ${header.map((h) => cell(humanize(h))).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join(" | ")} |`),
  ];
  return lines.join("\n");
}

/** Plain text (PDF, OCR, .txt) gets light structure: ALL CAPS or short Title Case lines become headings. */
export function textToMarkdown(title: string, text: string): string {
  const out: string[] = [`# ${title}`, ""];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      out.push("");
      continue;
    }
    const isHeading = line.length < 60 && !/[.,;]$/.test(line) && (/^[A-Z0-9 &/'-]{4,}$/.test(line) || /^(\d+\.\s+)?[A-Z][\w'&/-]*(\s+[A-Z&][\w'&/-]*){0,6}$/.test(line));
    out.push(isHeading ? `## ${line.replace(/^\d+\.\s+/, "")}` : line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
