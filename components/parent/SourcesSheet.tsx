"use client";

import { ExternalLink, FileText } from "lucide-react";
import type { Citation } from "@/lib/schemas";
import { Sheet } from "@/components/ui/Sheet";

const KIND: Record<string, string> = { notion: "Notion page", drive: "Google Drive", calendar: "Google Calendar", ical: "School calendar", upload: "Uploaded file", manual: "Written by the front desk" };

/** Where an answer came from: the exact passages, so a parent can check it themselves. */
export function SourcesSheet({ data, onClose }: { data: { citations: Citation[]; focus: number } | null; onClose: () => void }) {
  return (
    <Sheet open={data !== null} onOpenChange={(o) => !o && onClose()} title="Where this answer came from" description="The exact passages from the school's documents." snapPoints={[0.6, 0.95]}>
      <ul className="space-y-3">
        {data?.citations.map((c, i) => (
          <li key={c.id} className={`rounded-[16px] p-4 ring-1 ${i === data.focus ? "bg-accent-tint-2 ring-line" : "bg-surface ring-line-soft"}`}>
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-dense font-semibold text-ink">{c.title}</p>
                <p className="text-caption text-muted">
                  {KIND[c.sourceKind] ?? "School document"}
                  {c.heading && c.heading !== c.title ? ` · ${c.heading}` : ""}
                  {c.updatedAt ? ` · updated ${new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </p>
              </div>
            </div>
            <blockquote className="mt-3 whitespace-pre-line border-l-2 border-accent/40 pl-3 text-dense text-ink">{c.excerpt}…</blockquote>
            {c.url && !c.url.includes("/demo/") ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-label font-semibold text-accent">
                Open original <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
