import { Fragment, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * A small Markdown renderer for knowledge pages (headings, lists, tables,
 * bold, quotes) that can mark Privacy Guard findings inline: a held phrase
 * gets a warm highlight with a dashed underline and a shield, never alarm red.
 */

export interface Mark {
  text: string;
  status: string;
  label: string;
}

function inline(text: string, marks: Mark[], key: string): ReactNode {
  const active = marks.filter((m) => m.status !== "dismissed" && m.text.length > 2);
  const parts: Array<{ t: string; mark: Mark | null }> = [{ t: text, mark: null }];
  for (const m of active) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.mark) continue;
      const at = p.t.indexOf(m.text);
      if (at < 0) continue;
      parts.splice(i, 1, { t: p.t.slice(0, at), mark: null }, { t: m.text, mark: m }, { t: p.t.slice(at + m.text.length), mark: null });
      i += 2;
    }
  }
  return parts.map((p, i) =>
    p.mark ? (
      <mark
        key={`${key}-${i}`}
        title={`${p.mark.label}: ${p.mark.status === "redacted" ? "redacted" : p.mark.status === "staff_only" ? "staff only" : "held for review"}`}
        className={`rounded-[4px] px-0.5 underline decoration-dashed decoration-[1.5px] underline-offset-4 ${p.mark.status === "redacted" ? "bg-sunken text-muted line-through decoration-solid" : "bg-warning-tint text-warning-ink"}`}
      >
        {bold(p.t, `${key}-${i}`)}
        <ShieldCheck className="ml-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      </mark>
    ) : (
      <Fragment key={`${key}-${i}`}>{bold(p.t, `${key}-${i}`)}</Fragment>
    ),
  );
}

function bold(t: string, key: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}b${n++}`} className="font-semibold text-ink">{m[1]}</strong>);
    else if (m[2]) out.push(<em key={`${key}i${n++}`}>{m[2]}</em>);
    else out.push(<code key={`${key}c${n++}`} className="rounded bg-sunken px-1 text-[0.9em]">{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

export function MarkdownView({ content, marks = [] }: { content: string; marks?: Mark[] }) {
  // Split multi-line findings so each line can be highlighted where it appears.
  const lineMarks = marks.flatMap((m) => m.text.split("\n").map((t) => ({ ...m, text: t.replace(/^[-*>\s|]+/, "").trim() })).filter((m) => m.text.length > 2));
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `l${i}`;
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl === 1 ? "mt-2 text-[26px] font-bold tracking-[-0.02em]" : lvl === 2 ? "mt-7 text-title-2 font-bold" : "mt-5 text-headline font-semibold";
      blocks.push(<p key={k} role="heading" aria-level={Math.min(lvl + 1, 6)} className={`${cls} text-ink`}>{inline(h[2].replace(/#+\s*$/, ""), lineMarks, k)}</p>);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k} className="my-3 overflow-x-auto rounded-[12px] ring-1 ring-line-soft">
          <table className="w-full text-left text-dense">
            <thead className="bg-sunken text-label text-muted">
              <tr>{head?.map((c, j) => <th key={j} className="whitespace-nowrap px-3 py-2 font-semibold">{inline(c, lineMarks, `${k}h${j}`)}</th>)}</tr>
            </thead>
            <tbody className="tabular">
              {body.map((r, ri) => (
                <tr key={ri} className="border-t border-line-soft">
                  {r.map((c, j) => <td key={j} className="px-3 py-2 text-ink">{inline(c, lineMarks, `${k}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*+]|\d+[.)]|\[ ?x?\])\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+[.)]/.test(line);
      while (i < lines.length && /^\s*([-*+]|\d+[.)]|\[ ?x?\])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={k} className={`my-2 space-y-1 pl-5 text-body text-ink ${ordered ? "list-decimal" : "list-disc"} marker:text-muted`}>
          {items.map((it, j) => <li key={j}>{inline(it, lineMarks, `${k}-${j}`)}</li>)}
        </List>,
      );
      continue;
    }
    if (/^\s*>/.test(line)) {
      blocks.push(<blockquote key={k} className="my-2 border-l-2 border-accent/40 pl-3 text-body text-muted">{inline(line.replace(/^\s*>\s?/, ""), lineMarks, k)}</blockquote>);
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={k} className="my-2 text-pretty text-body leading-7 text-ink">{inline(para.join(" "), lineMarks, k)}</p>);
  }
  return <div>{blocks}</div>;
}
