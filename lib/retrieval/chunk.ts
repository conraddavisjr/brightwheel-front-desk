/**
 * Structure-first chunking. A handbook is already organized by its author:
 * headings say what a section is about, a table is one fact, a list belongs
 * to the sentence that introduces it. So we split on headings first, keep
 * tables and lists whole, and only fall back to paragraph packing when a
 * section is long. Each chunk carries its heading path ("Tuition > Infants")
 * because that path is often the best search signal a passage has.
 */

export interface Chunk {
  ord: number;
  heading: string;
  text: string;
}

/** About 400 tokens. */
const TARGET_CHARS = 1600;
const MAX_CHARS = 2400;

interface Section {
  path: string[];
  blocks: string[];
}

function blocksOf(lines: string[]): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  let kind: "table" | "list" | "para" | null = null;
  const flush = () => {
    if (cur.length) blocks.push(cur.join("\n").trim());
    cur = [];
    kind = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      if (kind !== "list") flush();
      continue;
    }
    const k = /^\s*\|/.test(line) ? "table" : /^\s*(?:[-*+]|\d+[.)])\s+/.test(line) ? "list" : "para";
    // A list continues the paragraph that introduces it ("Keep your child home if:").
    if (k === "list" && kind === "para" && /:\s*$/.test(cur[cur.length - 1] ?? "")) {
      kind = "list";
    } else if (kind && k !== kind) {
      flush();
    }
    kind = kind ?? k;
    cur.push(line);
  }
  flush();
  return blocks.filter(Boolean);
}

export function sections(markdown: string, title: string): Section[] {
  const out: Section[] = [];
  const path: string[] = [];
  let lines: string[] = [];
  const push = () => {
    const blocks = blocksOf(lines);
    if (blocks.length) out.push({ path: [...path], blocks });
    lines = [];
  };
  for (const line of markdown.split("\n")) {
    const h = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      push();
      const level = h[1].length;
      path.length = Math.min(path.length, level - 1);
      path[level - 1] = h[2].replace(/[*_`]/g, "").trim();
      for (let i = 0; i < path.length; i++) if (path[i] === undefined) path[i] = "";
      continue;
    }
    lines.push(line);
  }
  push();
  return out.map((s) => ({ ...s, path: [title, ...s.path.filter(Boolean).filter((p) => p !== title)] }));
}

/** Split one oversized block (a long table or paragraph) by lines or sentences. */
function splitBlock(block: string): string[] {
  if (block.length <= MAX_CHARS) return [block];
  const isTable = block.startsWith("|");
  const units = isTable ? block.split("\n") : block.split(/(?<=[.!?])\s+/);
  const header = isTable ? units.slice(0, 2).join("\n") : "";
  const out: string[] = [];
  let cur = "";
  for (const u of isTable ? units.slice(2) : units) {
    if (cur.length + u.length > TARGET_CHARS && cur) {
      out.push(isTable ? `${header}\n${cur}`.trim() : cur.trim());
      cur = "";
    }
    cur += (cur ? (isTable ? "\n" : " ") : "") + u;
  }
  if (cur) out.push(isTable ? `${header}\n${cur}`.trim() : cur.trim());
  return out;
}

/**
 * Small sibling sections ("Keep your child home if: > Fever", "> Vomiting",
 * "> Rash") are folded into their parent, each sub-heading kept as a bold
 * lead-in. One chunk then answers "when do I keep my child home?" whole,
 * instead of five fragments that each miss the rest of the rule.
 */
const SMALL_SECTION = 700;
function foldSmallSiblings(list: Section[]): Section[] {
  const out: Section[] = [];
  for (const s of list) {
    const size = s.blocks.join("\n").length;
    const parent = s.path.slice(0, -1);
    const prev = out[out.length - 1];
    const prevSize = prev ? prev.blocks.join("\n").length : Infinity;
    const sameParent = prev && parent.length >= 2 && (prev.path.join("\u0000") === parent.join("\u0000") || prev.path.slice(0, -1).join("\u0000") === parent.join("\u0000"));
    if (prev && sameParent && size < SMALL_SECTION && prevSize + size < TARGET_CHARS) {
      // Turn the previous section into the parent if it was a sibling, then append this one with its heading.
      if (prev.path.length > parent.length) {
        prev.blocks = [`**${prev.path[prev.path.length - 1]}:** ${prev.blocks[0]}`, ...prev.blocks.slice(1)];
        prev.path = parent;
      }
      prev.blocks.push(`**${s.path[s.path.length - 1]}:** ${s.blocks[0]}`, ...s.blocks.slice(1));
      continue;
    }
    out.push({ path: [...s.path], blocks: [...s.blocks] });
  }
  return out;
}

export function chunkMarkdown(markdown: string, title: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const s of foldSmallSiblings(sections(markdown, title))) {
    const heading = s.path.filter(Boolean).join(" > ");
    const pieces = s.blocks.flatMap(splitBlock);
    let cur: string[] = [];
    let len = 0;
    const emit = () => {
      if (cur.length) chunks.push({ ord: chunks.length, heading, text: cur.join("\n\n") });
    };
    for (const p of pieces) {
      if (len + p.length > TARGET_CHARS && cur.length) {
        emit();
        // Overlap: carry the last short paragraph so a split never strands a sentence's context.
        const last = cur[cur.length - 1];
        cur = last.length < 400 ? [last] : [];
        len = cur.reduce((n, x) => n + x.length, 0);
      }
      cur.push(p);
      len += p.length;
    }
    emit();
  }
  // Drop chunks that are only a withheld marker or a stray line.
  return chunks
    .filter((c) => c.text.replace(/\[withheld\]/g, "").replace(/\W/g, "").length > 12)
    .map((c, i) => ({ ...c, ord: i }));
}
