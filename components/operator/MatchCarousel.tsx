"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, FileText } from "lucide-react";

export interface Match {
  documentId: string;
  title: string;
  heading: string;
  excerpt: string;
}

/**
 * The closest passages in the school's documents, as short swipeable cards. Each opens its page
 * in Knowledge; the dots show how many there are and which one is in view.
 */
export function MatchCarousel({ matches }: { matches: Match[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (card) setActive(Math.min(matches.length - 1, Math.round(el.scrollLeft / (card.offsetWidth + 8))));
  };
  return (
    <div>
      <ul ref={track} onScroll={onScroll} aria-label="Closest passages" className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        {matches.map((m) => (
          <li key={m.documentId + m.heading} className="w-[82%] shrink-0 snap-start sm:w-[72%]">
            <Link href={`/operator/knowledge?doc=${m.documentId}`} className="group block h-full rounded-[12px] bg-sunken p-3 transition hover:ring-1 hover:ring-line">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-ink">
                <FileText className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                <span className="truncate">{m.title}</span>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted transition group-hover:text-accent" aria-hidden />
              </span>
              {m.heading ? <span className="mt-0.5 block truncate text-caption text-muted">{m.heading}</span> : null}
              <span className="mt-1 line-clamp-2 text-caption text-muted">{m.excerpt}</span>
            </Link>
          </li>
        ))}
      </ul>
      {matches.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {matches.map((m, i) => (
            <span key={m.documentId + m.heading} className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-accent" : "w-1.5 bg-line-strong"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
