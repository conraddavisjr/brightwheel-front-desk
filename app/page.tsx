import Link from "next/link";
import { BookOpenCheck, CalendarDays, MessageCircleQuestion, ShieldCheck, Sparkles, Mic, Inbox, PlugZap } from "lucide-react";
import { Wordmark } from "@/components/brand/WheelMark";
import { SignInButton } from "@/components/landing/SignInButton";
import { Pill } from "@/components/ui/Pill";
import { Disclaimer } from "@/components/brand/Disclaimer";

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 -top-40 h-[520px] blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <Link href="#how" className="rounded-full px-3 py-2 text-label font-semibold text-muted hover:text-ink">
          How it works
        </Link>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="pt-6 pb-10 text-center sm:pt-12">
          <Pill tone="ai" dot={false} className="mx-auto">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI front desk for childcare
          </Pill>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-[38px] font-bold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[56px]">
            Every family question, answered from your own handbook.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[17px] leading-7 text-muted sm:text-[19px]">
            Parents get instant, cited answers by text, voice or a guided flow. Directors keep the source of truth in the tools they already use, see what families ask, and close gaps in one click.
          </p>
        </section>

        <section aria-label="Choose a perspective" className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-[28px] bg-surface p-5 shadow-2 ring-1 ring-line-soft sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-title-2 font-bold">Parent experience</h2>
              <Pill tone="accent">Mobile first</Pill>
            </div>
            <p className="mt-2 text-dense text-muted">Ask anything by text, voice or a guided flow. Answers cite the school&apos;s own documents, and anything uncertain goes to staff.</p>
            <ParentPreview />
            <div className="mt-5 grid gap-2.5">
              <SignInButton school="harbor-kids" role="parent">
                Ask Harbor Kids as Maya
              </SignInButton>
              <SignInButton school="sunflower-valley" role="parent" variant="secondary">
                Ask Sunflower Valley as Priya
              </SignInButton>
            </div>
          </article>

          <article className="rounded-[28px] bg-surface p-5 shadow-2 ring-1 ring-line-soft sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-title-2 font-bold">Operator experience</h2>
              <Pill tone="teal">For directors</Pill>
            </div>
            <p className="mt-2 text-dense text-muted">Connect Notion, Google Drive and Calendar. Privacy Guard holds anything sensitive before families can search it. See every question and fix gaps fast.</p>
            <OperatorPreview />
            <div className="mt-5 grid gap-2.5">
              <SignInButton school="harbor-kids" role="director">
                Harbor Kids · Notion, Drive and Calendar
              </SignInButton>
              <SignInButton school="sunflower-valley" role="director" variant="secondary">
                Sunflower Valley · Notion only
              </SignInButton>
            </div>
          </article>
        </section>

        <section id="how" className="mt-16 scroll-mt-8">
          <h2 className="text-center text-title-1 font-bold">Things to try in five minutes</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRY.map((t) => (
              <li key={t.title} className="rounded-[20px] bg-surface p-5 shadow-1 ring-1 ring-line-soft">
                <span className={`inline-grid h-10 w-10 place-items-center rounded-full ${t.tint}`}>
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 text-headline font-semibold">{t.title}</h3>
                <p className="mt-1 text-dense text-muted">{t.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Disclaimer />
    </div>
  );
}

const TRY = [
  { icon: MessageCircleQuestion, tint: "bg-accent-tint text-accent", title: "Ask a real question", body: "\"Is my kid too sick to come in?\" Harbor Kids has two illness policies that disagree. Watch how it handles that." },
  { icon: CalendarDays, tint: "bg-teal-tint text-teal-ink", title: "Get an event card", body: "\"When is picture day?\" returns a card you can add to Google or Apple Calendar in one tap." },
  { icon: ShieldCheck, tint: "bg-warning-tint text-warning-ink", title: "Try to break it", body: "\"What's the door code?\" or \"Which kids have lice?\" The codes are in the docs. Privacy Guard keeps them out." },
  { icon: Inbox, tint: "bg-pink-tint text-pink-ink", title: "Close a gap", body: "Ask about summer camp as a parent, then answer it as the director. Ask again: now it knows." },
  { icon: Mic, tint: "bg-ai-tint text-ai-ink", title: "Talk to it", body: "Tap the mic and ask out loud. It answers back, and a short line plays while it looks things up." },
  { icon: PlugZap, tint: "bg-info-tint text-info-ink", title: "Connect a source", body: "Connect your own Notion or pick Google Drive files and watch them become searchable." },
  { icon: BookOpenCheck, tint: "bg-success-tint text-success-ink", title: "Edit the truth", body: "Change a policy in Knowledge and the next answer uses it, with the source cited." },
  { icon: Sparkles, tint: "bg-orange-tint text-orange-ink", title: "Read the decisions", body: "The README explains grounding, privacy, cost and what we would build next." },
];

function ParentPreview() {
  return (
    <div aria-hidden className="mt-5 overflow-hidden rounded-[22px] bg-canvas p-4 ring-1 ring-line-soft">
      <div className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-md bg-accent px-3.5 py-2 text-dense text-on-accent">When is picture day?</div>
      <div className="ai-edge mt-3 overflow-hidden rounded-[18px] bg-surface p-3.5 shadow-1">
        <div className="flex items-center gap-1.5 text-caption font-semibold text-ai-ink">
          <Sparkles className="h-3.5 w-3.5" /> Front Desk
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-teal-tint text-center leading-none text-teal-ink">
            <span className="text-[10px] font-bold uppercase">Oct</span>
            <span className="text-[19px] font-bold">22</span>
          </div>
          <div className="min-w-0">
            <p className="text-dense font-semibold text-ink">Picture Day</p>
            <p className="text-caption text-muted">Thursday · 9:00am - 12:00pm</p>
          </div>
          <span className="ml-auto rounded-full bg-accent-tint px-3 py-1.5 text-caption font-semibold text-accent">Add</span>
        </div>
      </div>
      <div className="ai-ring mt-4 flex h-11 items-center rounded-full bg-surface px-4 text-dense text-placeholder shadow-ai">Ask about hours, tuition, menus…</div>
    </div>
  );
}

function OperatorPreview() {
  const bars = [4, 6, 5, 7, 6, 3, 2, 8, 9, 7, 12, 11, 8, 6, 7, 18, 14, 9, 7, 8];
  return (
    <div aria-hidden className="mt-5 overflow-hidden rounded-[22px] bg-canvas-operator p-4 ring-1 ring-line-soft">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          ["Answered", "512"],
          ["No staff needed", "87%"],
          ["Hours saved", "21h"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[12px] bg-surface p-2.5 shadow-1">
            <p className="text-[11px] font-semibold text-muted">{k}</p>
            <p className="tabular text-[19px] font-bold text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex h-16 items-end gap-1 rounded-[12px] bg-surface p-2.5 shadow-1">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 rounded-t-[3px] bg-accent/80" style={{ height: `${(b / 18) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-[12px] bg-surface p-2.5 shadow-1">
        <ShieldCheck className="h-4 w-4 text-warning-ink" />
        <span className="text-caption font-semibold text-ink">Alarm code found in &quot;Parent Info&quot;</span>
        <span className="ml-auto rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-semibold text-warning-ink">Held</span>
      </div>
    </div>
  );
}
