"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Bar {
  key: string;
  label: string;
  count: number;
  href?: string;
}

function Bars({ items, max }: { items: Bar[]; max: number }) {
  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <li key={b.key}>
          <div className="flex items-center justify-between gap-3 text-dense">
            {b.href ? (
              <Link href={b.href} className="truncate font-medium text-ink hover:text-accent">
                {b.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-ink">{b.label}</span>
            )}
            <span className="tabular text-muted">{b.count}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-sunken">
            <div className="h-1.5 rounded-full" style={{ width: `${max ? (b.count / max) * 100 : 0}%`, background: "var(--chart-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The most-cited documents as bars; "See all" opens the rest and what families ask about, in the same bars. */
export function SourcesUsage({ sources, topics, visible = 4 }: { sources: Bar[]; topics: Bar[]; visible?: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (sources.length === 0) return <p className="text-dense text-muted">Sources appear here as families ask questions.</p>;
  const max = sources[0].count;
  const more = sources.slice(visible);
  return (
    <div>
      <Bars items={sources.slice(0, visible)} max={max} />
      {/* Height animates open and closed (0fr to 1fr); hidden content stays out of tab order while closed. */}
      <div id={panelId} className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          {more.length ? (
            <div className="pt-3">
              <Bars items={more} max={max} />
            </div>
          ) : null}
          {topics.length ? (
            <div className="pt-5">
              <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">What families ask about</p>
              <div className="mt-2.5">
                <Bars items={topics} max={topics[0].count} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="mt-4 inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-label font-semibold text-accent hover:bg-accent-tint">
        {open ? "See less" : "See all"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
    </div>
  );
}
