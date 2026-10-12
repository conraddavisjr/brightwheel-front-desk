"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";

const SYMPTOMS = [
  { id: "fever", label: "Fever of 100.4°F or higher" },
  { id: "vomiting", label: "Vomiting" },
  { id: "diarrhea", label: "Diarrhea" },
  { id: "pinkeye", label: "Pink eye (red, goopy eyes)" },
  { id: "rash", label: "A rash with fever" },
  { id: "lice", label: "Lice or nits" },
  { id: "cough", label: "Cough or runny nose only" },
] as const;

/**
 * A guided flow for the most common front-desk call. It never diagnoses:
 * it turns a few taps into a precise question, and the answer comes from
 * the school's own illness policy with citations.
 */
export function SickCheckSheet({ open, onClose, onAsk, childName }: { open: boolean; onClose: () => void; onAsk: (q: string) => void; childName: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [meds, setMeds] = useState<boolean | null>(null);
  useEffect(() => {
    if (open) {
      setPicked([]);
      setMeds(null);
    }
  }, [open]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const labels = SYMPTOMS.filter((s) => picked.includes(s.id)).map((s) => s.label.toLowerCase().replace(/ \(.+\)/, ""));
  const question =
    picked.length === 0
      ? `${childName} has no symptoms in the last 24 hours. Is there anything I should know about the illness policy?`
      : `In the last 24 hours ${childName} had: ${labels.join(", ")}${picked.includes("fever") && meds ? " (we gave fever-reducing medicine)" : ""}. Can ${childName} come to school today, and when can they come back?`;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Can ${childName} come in today?`}
      description="Check anything from the last 24 hours. This uses the school's illness policy; it is not medical advice."
      snapPoints={[0.85, 0.98]}
      footer={
        <button type="button" onClick={() => onAsk(question)} className="h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover active:scale-[0.99]">
          Check the policy
        </button>
      }
    >
      <fieldset>
        <legend className="sr-only">Symptoms in the last 24 hours</legend>
        <div className="grid gap-2">
          {SYMPTOMS.map((s) => {
            const on = picked.includes(s.id);
            return (
              <label key={s.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] px-4 ring-1 transition ${on ? "bg-accent-tint ring-accent" : "bg-surface ring-line-soft hover:ring-line"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(s.id)} />
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] ring-1 ${on ? "bg-accent text-on-accent ring-accent" : "ring-line-strong"}`}>{on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}</span>
                <span className="text-body text-ink">{s.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {picked.includes("fever") ? (
        <fieldset className="rise-in mt-5">
          <legend className="text-dense font-semibold text-ink">Did {childName} have fever-reducing medicine (Tylenol, Motrin)?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              [true, "Yes"],
              [false, "No"],
            ].map(([v, l]) => (
              <button key={String(l)} type="button" aria-pressed={meds === v} onClick={() => setMeds(v as boolean)} className={`min-h-12 rounded-full text-dense font-semibold ring-1 transition ${meds === v ? "bg-accent text-on-accent ring-accent" : "bg-surface text-ink ring-line"}`}>
                {l as string}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </Sheet>
  );
}
