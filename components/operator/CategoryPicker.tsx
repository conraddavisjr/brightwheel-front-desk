"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Baby, BriefcaseBusiness, Check, ChevronDown, Contact, HeartPulse, KeyRound, Landmark, LockKeyhole, Megaphone, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
import { CATEGORY_LABEL, PRIVACY_CATEGORIES, type PrivacyCategory } from "@/lib/schemas";

/** What each kind of protected information covers, in a director's words. */
const KINDS: Record<PrivacyCategory, { icon: LucideIcon; tint: string; description: string }> = {
  custom: { icon: Sparkles, tint: "bg-ai-tint text-ai-ink", description: "Something specific to your school." },
  child_record: { icon: Baby, tint: "bg-pink-tint text-pink-ink", description: "One child's records: incidents, assessments, IEP or IFSP notes." },
  family_safety: { icon: ShieldAlert, tint: "bg-danger-tint text-danger-ink", description: "Custody, court orders and who may pick a child up." },
  health_record: { icon: HeartPulse, tint: "bg-pink-tint text-pink-ink", description: "A child's or staff member's health, allergies or medications." },
  staff_hr: { icon: BriefcaseBusiness, tint: "bg-info-tint text-info-ink", description: "Wages, payroll, reviews and background checks." },
  financial: { icon: Landmark, tint: "bg-success-tint text-success-ink", description: "Bank, card and routing numbers, and family balances." },
  facility_security: { icon: KeyRound, tint: "bg-warning-tint text-warning-ink", description: "Door, alarm and gate codes, Wi-Fi and camera access." },
  embargoed: { icon: Megaphone, tint: "bg-orange-tint text-orange-ink", description: "Tuition changes, closures or news that isn't announced yet." },
  credentials: { icon: LockKeyhole, tint: "bg-teal-tint text-teal-ink", description: "Passwords, API keys and logins." },
  personal_contact: { icon: Contact, tint: "bg-accent-tint text-accent", description: "Personal phone numbers, emails and home addresses." },
};
// "Your rule" first: it is what a director adding a rule usually means.
const ORDER: PrivacyCategory[] = ["custom", ...PRIVACY_CATEGORIES.filter((c) => c !== "custom")];

/** A listbox with an icon and a one-line description per kind (keyboard: arrows, Home/End, Enter, Escape). */
export function CategoryPicker({ value, onChange, labelId }: { value: PrivacyCategory; onChange: (c: PrivacyCategory) => void; labelId: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(ORDER.indexOf(value));
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = KINDS[value];

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(ORDER.indexOf(value));
    setOpen(true);
  }
  function choose(i: number) {
    onChange(ORDER[i]);
    setOpen(false);
    button.current?.focus();
  }
  function onListKey(e: React.KeyboardEvent) {
    const last = ORDER.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, last));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <div ref={wrap} className="relative mt-1.5">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${listId}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-[12px] bg-surface py-2 pl-2.5 pr-4 text-left ring-1 ring-line-strong outline-none transition focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${current.tint}`}>
          <current.icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span id={`${listId}-value`} className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{CATEGORY_LABEL[value]}</span>
          <span className="block truncate text-caption text-muted">{current.description}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="pop-in absolute inset-x-0 top-full z-20 mt-1.5 max-h-[min(360px,50dvh)] overflow-y-auto overscroll-contain rounded-[16px] bg-raised p-1.5 shadow-3 ring-1 ring-line-soft outline-none"
        >
          {ORDER.map((c, i) => {
            const k = KINDS[c];
            const selected = c === value;
            return (
              <li
                key={c}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2 ${i === active ? "bg-sunken" : ""}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${k.tint}`}>
                  <k.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-dense font-semibold text-ink">{CATEGORY_LABEL[c]}</span>
                  <span className="block text-caption text-muted">{k.description}</span>
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : <span className="w-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
