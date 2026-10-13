import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { BrandIcon } from "@/components/operator/BrandIcon";
import { ago } from "@/lib/time";

export interface SourceRow {
  id: string;
  kind: string;
  name: string;
  status: string;
  account_label: string | null;
  last_synced_at: string | null;
}

const CATALOG = [
  { kind: "notion", name: "Notion", blurb: "Handbooks and policy pages" },
  { kind: "drive", name: "Google Drive", blurb: "Docs, Sheets and PDFs you pick" },
  { kind: "calendar", name: "Google Calendar", blurb: "Events, closures and holidays", alt: ["ical"] },
  { kind: "slack", name: "Slack", blurb: "Unanswered questions in a channel" },
];

export function IntegrationTiles({ sources, compact = false }: { sources: SourceRow[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
      {CATALOG.map((c) => {
        const connected = sources.filter((s) => s.kind === c.kind || c.alt?.includes(s.kind));
        const on = connected.length > 0;
        return (
          <li key={c.kind}>
            <Link href={`/operator/sources#${c.kind}`} className="flex h-full items-start gap-3 rounded-[14px] p-3 ring-1 ring-line-soft transition hover:bg-sunken hover:ring-line">
              <BrandIcon kind={c.kind} />
              <div className="min-w-0 flex-1">
                <p className="text-dense font-semibold text-ink">{c.name}</p>
                <p className="truncate text-caption text-muted">{on ? `${connected[0].account_label ?? "Connected"} · synced ${ago(connected[0].last_synced_at)}` : c.blurb}</p>
                <div className="mt-2">{on ? <Pill tone="success">Connected</Pill> : <Pill tone="neutral" dot={false}>Connect</Pill>}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
