"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BrandIcon } from "@/components/operator/BrandIcon";
import { FileText, ShieldCheck, Sparkles, X, ArrowRight, Pause, Play } from "lucide-react";

/**
 * The "how it works" banner on Home. A looping three-step mini demo built
 * from real UI pieces in CSS (the Palate FeatureTour idea): connect a doc,
 * Privacy Guard holds a code, a parent gets a cited answer. Pausable
 * (WCAG 2.2.2), still under reduced motion, dismissible and remembered.
 */
const STEPS = [
  { title: "Connect what you already use", body: "Notion pages, Drive docs and your calendar sync in. No retyping the handbook." },
  { title: "Privacy Guard checks everything", body: "Sensitive details like codes, payroll, custody notes and child health are found automatically and held for your approval before families can search them." },
  { title: "Families get cited answers", body: "Instant, specific, with the source. Anything unclear comes to your Inbox." },
];

/** How long each step stays up. Long enough to read on a first visit. */
const STEP_MS = 6400;
const KEY = "fd:banner:how";
const listeners = new Set<() => void>();
function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "dismissed";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HowItWorksBanner() {
  // Hidden during server render; the stored preference decides on the client.
  const hidden = useSyncExternalStore(subscribe, readDismissed, () => true);
  const motionOff = useSyncExternalStore(() => () => {}, reducedMotion, () => false);
  const [step, setStep] = useState(0);
  const [pausedByUser, setPaused] = useState(false);
  const paused = pausedByUser || motionOff;
  const setHidden = (v: boolean) => {
    if (!v) return;
    try {
      localStorage.setItem(KEY, "dismissed");
    } catch {}
    listeners.forEach((l) => l());
  };
  // The progress bar drives the carousel: each step advances when its bar fills, and pausing freezes the bar.
  const next = () => setStep((s) => (s + 1) % STEPS.length);
  if (hidden) return null;

  return (
    <section aria-label="How Front Desk works" className="rise-in relative overflow-hidden rounded-[24px] bg-surface shadow-2 ring-1 ring-line-soft">
      <div aria-hidden className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(60% 90% at 100% 0%, var(--accent-tint) 0%, transparent 60%), radial-gradient(40% 70% at 0% 100%, var(--pink-tint) 0%, transparent 60%)" }} />
      <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-ai-tint px-2.5 py-1 text-caption font-semibold text-ai-ink">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> How Front Desk works
          </p>
          <h2 className="mt-3 text-balance text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">Answer families instantly, from the docs you already have.</h2>
          <ol className="mt-4 space-y-2">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => { setStep(i); setPaused(true); }} aria-current={step === i ? "step" : undefined} className={`flex w-full gap-3 rounded-[14px] p-2.5 text-left transition ${step === i ? "items-start bg-surface shadow-1 ring-1 ring-line-soft" : "items-center opacity-70 hover:opacity-100"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-bold ${step === i ? "bg-accent text-on-accent" : "bg-sunken text-muted"}`}>{i + 1}</span>
                  <span>
                    <span className="block text-dense font-semibold text-ink">{s.title}</span>
                    {step === i ? (
                      // Every description sits in the same grid cell, so the slot is always as tall as the longest: no layout shift between steps.
                      <span className="grid">
                        {STEPS.map((o, j) => (
                          <span key={o.title} aria-hidden={j !== i} className={`col-start-1 row-start-1 text-dense text-muted ${j === i ? "fade-in" : "invisible"}`}>
                            {o.body}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/operator/sources" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-dense font-semibold text-on-accent shadow-1 hover:bg-accent-hover">
              Connect a source <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/operator/inbox" className="inline-flex min-h-11 items-center rounded-full px-4 text-dense font-semibold text-accent hover:bg-accent-tint">
              See what families asked
            </Link>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play demo" : "Pause demo"} className="relative ml-auto grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-sunken">
              {/* A quiet ring fills around the button as each step plays; when it closes, the next step starts. */}
              <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle cx="20" cy="20" r="18.5" fill="none" stroke="var(--border-soft)" strokeWidth="1.5" />
                {motionOff ? null : (
                  <circle
                    key={step}
                    cx="20"
                    cy="20"
                    r="18.5"
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100"
                    onAnimationEnd={next}
                    className="ring-progress"
                    style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                  />
                )}
              </svg>
              {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
        <Demo step={step} />
      </div>
      <button
        type="button"
        aria-label="Hide how it works"
        onClick={() => setHidden(true)}
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}

function Demo({ step }: { step: number }) {
  return (
    <div aria-hidden className="relative h-[260px] overflow-hidden rounded-[20px] bg-canvas p-4 ring-1 ring-line-soft">
      {step === 0 ? (
        <div key="s0" className="space-y-2.5">
          {[
            ["notion", "Notion", "Parent Info (READ ME)"],
            ["drive", "Google Drive", "Family Handbook 2026"],
            ["calendar", "Google Calendar", "Harbor Kids Family Calendar"],
          ].map(([kind, k, t], i) => (
            <div key={t} className="rise-in flex items-center gap-3 rounded-[14px] bg-surface p-3 shadow-1" style={{ animationDelay: `${i * 220}ms` }}>
              <BrandIcon kind={kind} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-dense font-semibold text-ink">{t}</p>
                <p className="text-caption text-muted">{k}</p>
              </div>
              <span className="pop-in rounded-full bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success-ink" style={{ animationDelay: `${i * 220 + 500}ms` }}>
                Synced
              </span>
            </div>
          ))}
        </div>
      ) : step === 1 ? (
        <div key="s1" className="rise-in rounded-[14px] bg-surface p-4 shadow-1">
          <p className="flex items-center gap-2 text-caption font-semibold text-muted">
            <FileText className="h-3.5 w-3.5" /> Parent Info (READ ME)
          </p>
          <p className="mt-3 text-dense leading-7 text-ink">
            Pickup is at 5:30. Late fee is $1 a minute.{" "}
            <span className="rounded-[4px] bg-warning-tint px-1 text-warning-ink underline decoration-dashed decoration-[1.5px] underline-offset-4">alarm code is 2580, gate code 1129</span> Please bring two sets of extra clothes.
          </p>
          <div className="pop-in mt-4 flex items-center gap-2 rounded-[12px] bg-warning-tint p-2.5 text-caption font-semibold text-warning-ink" style={{ animationDelay: "500ms" }}>
            <ShieldCheck className="h-4 w-4" /> Building codes held. Families can&apos;t search this.
          </div>
        </div>
      ) : (
        <div key="s2" className="space-y-2.5">
          <div className="rise-in ml-auto w-fit rounded-[16px] rounded-br-md bg-accent px-3 py-2 text-dense text-on-accent">Can my kid come in with a fever?</div>
          <div className="rise-in ai-edge overflow-hidden rounded-[16px] bg-surface p-3.5 shadow-1" style={{ animationDelay: "400ms" }}>
            <p className="flex items-center gap-1.5 text-caption font-semibold text-ai-ink">
              <Sparkles className="h-3.5 w-3.5" /> Front Desk
            </p>
            <p className="mt-1.5 text-dense font-semibold text-ink">Not today. Children need 24 hours fever-free, without medicine.</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] bg-sunken px-2 py-1 text-[11px] text-muted">
              <FileText className="h-3 w-3 text-accent" /> Illness Policy 2026
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
