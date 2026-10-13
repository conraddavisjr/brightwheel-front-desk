"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, Pencil } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { fmtTime, hoursFacts, type WeeklyHours } from "@/lib/answer/hours";

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

/**
 * The hours families are told. They are structured settings rather than handbook prose,
 * so "Are you open now?" is computed exactly, and this is the one place to change them.
 */
export function HoursPanel({ hours }: { hours: WeeklyHours }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WeeklyHours>(hours);
  const [busy, setBusy] = useState(false);
  const summary = hoursFacts(hours)
    .map((f) => `${f.label} ${f.value}`)
    .join(" · ");

  async function save() {
    setBusy(true);
    const full = Object.fromEntries(DAYS.map(([d]) => [d, draft[d] ?? null]));
    const res = await fetch("/api/operator/hours", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ hours: full }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't save the hours." });
    toast({ tone: "success", title: "Hours updated", body: "Families get the new hours in every answer now." });
    setOpen(false);
    router.refresh();
  }

  return (
    <section aria-label="School hours" className="flex flex-wrap items-center gap-3 rounded-[16px] bg-surface p-3.5 shadow-1 ring-1 ring-line-soft sm:p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-tint text-accent">
        <Clock3 className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-dense font-semibold text-ink">Hours families see</p>
        <p className="text-caption text-muted">{summary}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDraft(hours);
          setOpen(true);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-tint px-3.5 text-label font-semibold text-accent hover:brightness-95"
      >
        <Pencil className="h-4 w-4" aria-hidden /> Edit hours
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Hours families see"
        description="Every hours answer and the open-now status use these. Holidays and closures come from your calendar."
        snapPoints={[0.85]}
        footer={
          <button type="button" onClick={save} disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-dense font-semibold text-on-accent disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Save hours
          </button>
        }
      >
        <ul className="divide-y divide-line-soft">
          {DAYS.map(([d, label]) => {
            const value = draft[d] ?? null;
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-3">
                <label className="flex min-w-32 items-center gap-2.5 text-dense font-semibold text-ink">
                  <input
                    id={`open-${d}`}
                    type="checkbox"
                    checked={value !== null}
                    onChange={(e) => setDraft((h) => ({ ...h, [d]: e.target.checked ? (["07:30", "17:30"] as [string, string]) : null }))}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  {label}
                </label>
                {value ? (
                  <span className="flex items-center gap-2 text-dense text-muted">
                    <input aria-label={`${label} opens`} id={`from-${d}`} type="time" value={value[0]} onChange={(e) => setDraft((h) => ({ ...h, [d]: [e.target.value, value[1]] }))} className="h-10 rounded-[10px] bg-surface px-2.5 text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
                    to
                    <input aria-label={`${label} closes`} id={`to-${d}`} type="time" value={value[1]} onChange={(e) => setDraft((h) => ({ ...h, [d]: [value[0], e.target.value] }))} className="h-10 rounded-[10px] bg-surface px-2.5 text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
                    <span className="sr-only">
                      {fmtTime(value[0])} to {fmtTime(value[1])}
                    </span>
                  </span>
                ) : (
                  <span className="text-dense text-muted">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    </section>
  );
}
