"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, ArrowUp, CheckCircle2, Clock3, HelpCircle, Mic, Sparkles, Stethoscope, ChevronRight, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { possessive } from "@/lib/text";
import type { Pending, RecentQuestion, StaffReply } from "@/lib/db/parent";

export interface HomeData {
  replies: Array<StaffReply & { when: string }>;
  pending: Array<Pending & { when: string }>;
  recent: Array<RecentQuestion & { when: string }>;
}

const QUICK = [
  { label: "Hours", q: "What are your hours?" },
  { label: "What's coming up", q: "What's coming up this month?" },
  { label: "Tuition", q: "How much is tuition?" },
];

// Which staff replies this parent has already seen, remembered per browser.
const listeners = new Set<() => void>();
function seenKey(personId: string) {
  return `fd:seen:${personId}`;
}
function readSeen(personId: string): string {
  try {
    return localStorage.getItem(seenKey(personId)) ?? "[]";
  } catch {
    return "[]";
  }
}
function markSeen(personId: string, id: string) {
  try {
    const ids = new Set(JSON.parse(readSeen(personId)) as string[]);
    ids.add(id);
    localStorage.setItem(seenKey(personId), JSON.stringify([...ids]));
  } catch {
    /* storage blocked: it stays highlighted for this visit */
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const noop = () => () => {};

const chat = (q: string) => `/ask/chat?q=${encodeURIComponent(q)}`;

/** The parent's home: a way into chat, what staff said back, what's still waiting, and recent questions. */
export function ParentHome({ personId, school, parent, data }: { personId: string; school: { shortName: string }; parent: { name: string; firstName: string; hue: number; child: { name: string; room: string } | null }; data: HomeData }) {
  const hello = useSyncExternalStore(noop, greeting, () => "Hello");
  const seenRaw = useSyncExternalStore(subscribe, () => readSeen(personId), () => "[]");
  const seen = new Set(JSON.parse(seenRaw) as string[]);
  const unread = data.replies.filter((r) => !seen.has(r.id));
  const child = parent.child?.name ?? "your child";

  return (
    <main className="flex-1 px-4 pb-16 sm:px-6">
      <section className="rise-in flex items-center gap-3 pt-5 sm:pt-8">
        <Avatar name={parent.name} hue={parent.hue} size={48} />
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-display">
            {hello}, {parent.firstName}
          </h1>
          {parent.child ? (
            <p className="text-dense text-muted">
              {parent.child.name} · {parent.child.room}
            </p>
          ) : null}
        </div>
      </section>

      {/* The way in: one tap to chat with the front desk. */}
      <Link href="/ask/chat" className="ai-edge rise-in group mt-6 block overflow-hidden rounded-[24px] bg-surface p-5 shadow-2 transition hover:-translate-y-0.5 hover:shadow-3 sm:p-6" style={{ animationDelay: "40ms" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-tint px-2.5 py-1 text-caption font-semibold text-ai-ink">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Front Desk
        </span>
        <span className="mt-3 block text-title-2 font-bold text-ink">Ask {school.shortName} anything</span>
        <span className="mt-1 block text-dense text-muted">Hours, the sick policy, tuition, what&apos;s coming up. Answers come from {possessive(school.shortName)} own documents, and staff help with the rest.</span>
        <span className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-canvas pl-4 pr-1.5 ring-1 ring-line">
          <span className="flex-1 truncate text-body text-muted">Ask a question…</span>
          <Mic className="h-5 w-5 text-muted" aria-hidden />
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent transition-transform group-hover:translate-x-0.5">
            <ArrowUp className="h-4 w-4" aria-hidden />
          </span>
        </span>
      </Link>
      <div className="rise-in mt-3 flex flex-wrap gap-2" style={{ animationDelay: "80ms" }}>
        {QUICK.map((c) => (
          <Link key={c.label} href={chat(c.q)} className="inline-flex min-h-10 items-center rounded-full bg-surface px-3.5 text-label font-semibold text-ink shadow-1 ring-1 ring-line-soft hover:bg-accent-tint-2">
            {c.label}
          </Link>
        ))}
        <Link href="/ask/chat?check=sick" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-pink-tint px-3.5 text-label font-semibold text-pink-ink hover:brightness-95">
          <Stethoscope className="h-4 w-4" aria-hidden /> Can {child} come in today?
        </Link>
      </div>

      {data.replies.length ? (
        <section aria-labelledby="replies" className="rise-in mt-9" style={{ animationDelay: "120ms" }}>
          <h2 id="replies" className="flex items-center gap-2 text-headline font-semibold text-ink">
            From the front desk
            {unread.length ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-on-accent">
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-on-accent" style={{ color: "var(--on-accent)" }} aria-hidden />
                {unread.length} new
              </span>
            ) : null}
          </h2>
          <ul className="mt-3 space-y-3">
            {data.replies.map((r) => {
              const fresh = !seen.has(r.id);
              return (
                <li key={r.id} className={`rounded-[20px] p-4 transition ${fresh ? "reply-glow bg-surface ring-2 ring-accent" : "bg-surface shadow-1 ring-1 ring-line-soft"}`}>
                  <div className="flex items-center gap-3">
                    {r.by ? <Avatar name={r.by.name} hue={r.by.hue} size={36} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-tint text-accent"><MessageCircle className="h-4 w-4" aria-hidden /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-dense font-semibold text-ink">
                        {r.by?.name.split(" ")[0] ?? "Staff"} {r.kind === "answer" ? "answered your question" : "replied to your message"}
                      </p>
                      <p className="text-caption text-muted">{r.when}</p>
                    </div>
                    {fresh ? <Pill tone="accent">New</Pill> : null}
                  </div>
                  <p className="mt-3 border-l-2 border-line pl-3 text-dense text-muted">{r.kind === "answer" ? `You asked: “${r.about}”` : `You wrote: “${r.about}”`}</p>
                  <p className="mt-2.5 text-body text-ink">{r.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {fresh ? (
                      <button type="button" onClick={() => markSeen(personId, r.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-label font-semibold text-on-accent hover:bg-accent-hover">
                        <CheckCircle2 className="h-4 w-4" aria-hidden /> Got it
                      </button>
                    ) : null}
                    {r.kind === "answer" ? (
                      <Link href={chat(r.about)} onClick={() => markSeen(personId, r.id)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-label font-semibold text-accent hover:bg-accent-tint">
                        Ask about it <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.pending.length ? (
        <section aria-labelledby="pending" className="rise-in mt-9" style={{ animationDelay: "160ms" }}>
          <h2 id="pending" className="text-headline font-semibold text-ink">Waiting on the front desk</h2>
          <p className="mt-0.5 text-dense text-muted">Staff usually reply within a day. Their answer shows up here.</p>
          <ul className="mt-3 overflow-hidden rounded-[20px] bg-surface shadow-1 ring-1 ring-line-soft">
            {data.pending.map((p) => (
              <li key={p.id} className="flex items-start gap-3 border-b border-line-soft p-4 last:border-0">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning-tint text-warning-ink">
                  <Clock3 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-dense text-ink">{p.text}</p>
                  <p className="mt-0.5 text-caption text-muted">
                    {p.kind === "question" ? "Question" : "Message"} · sent {p.when}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent" className="rise-in mt-9" style={{ animationDelay: "200ms" }}>
        <h2 id="recent" className="text-headline font-semibold text-ink">Your recent questions</h2>
        {data.recent.length ? (
          <ul className="mt-3 overflow-hidden rounded-[20px] bg-surface shadow-1 ring-1 ring-line-soft">
            {data.recent.map((q) => (
              <li key={q.id} className="border-b border-line-soft last:border-0">
                <Link href={chat(q.question)} className="flex items-start gap-3 p-4 transition hover:bg-sunken">
                  {q.outcome === "answered" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Answered" />
                  ) : q.outcome === "staff" ? (
                    <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-label="Answered by staff" />
                  ) : (
                    <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" aria-label="Sent to staff" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-dense font-semibold text-ink">{q.question}</span>
                    <span className="mt-0.5 line-clamp-2 block text-dense text-muted">{q.answer}</span>
                    <span className="mt-1 block text-caption text-muted">{q.when}</span>
                  </span>
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-dense text-muted">Questions you ask show up here, so you can find an answer again.</p>
        )}
      </section>

      <p className="mt-10 text-center text-[11px] text-muted">AI answers from {possessive(school.shortName)} documents. Staff can always help.</p>
    </main>
  );
}
