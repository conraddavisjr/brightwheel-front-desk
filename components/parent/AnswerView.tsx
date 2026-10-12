"use client";

import { Sparkles, ThumbsUp, ThumbsDown, Phone, MessageSquare, FileText, BookOpen, ShieldAlert, HeartHandshake, Info, Check } from "lucide-react";
import type { AnswerCard, Citation } from "@/lib/schemas";
import { EventCard } from "@/components/parent/EventCard";
import { Pill } from "@/components/ui/Pill";

export interface AnswerViewProps {
  card: Partial<AnswerCard>;
  streaming: boolean;
  status?: string | null;
  schoolName: string;
  feedback?: 1 | -1 | null;
  onFeedback?: (v: 1 | -1) => void;
  onFollowUp?: (q: string) => void;
  onOpenSources?: (citations: Citation[], focus: number) => void;
  onMessageStaff?: () => void;
}

const SOURCE_LABEL: Record<string, string> = { notion: "Notion", drive: "Google Drive", calendar: "Calendar", ical: "Calendar", upload: "Upload", manual: "Front Desk", slack: "Slack" };

export function AnswerView({ card, streaming, status, schoolName, feedback, onFeedback, onFollowUp, onOpenSources, onMessageStaff }: AnswerViewProps) {
  const outcome = card.outcome ?? "answered";
  const tone = outcome === "care" ? "care" : outcome === "answered" ? "answer" : "handoff";
  const hasText = Boolean(card.headline);
  const done = !streaming && hasText;

  return (
    <article
      aria-busy={streaming}
      className={`overflow-hidden rounded-[20px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-5 ${streaming || outcome === "answered" ? "ai-edge" : ""} ${tone === "care" ? "!ring-danger/30" : ""}`}
    >
      <header className="flex items-center gap-2">
        <span className={`inline-grid h-6 w-6 place-items-center rounded-full ${tone === "care" ? "bg-danger-tint text-danger-ink" : "bg-ai-tint text-ai-ink"}`}>
          {tone === "care" ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        </span>
        <span className="text-label font-semibold text-ink">Front Desk</span>
        {outcome === "unsure" && done ? <Pill tone="info">Sent to staff</Pill> : null}
        {outcome === "handoff" && done ? <Pill tone="accent">Staff can help</Pill> : null}
        {outcome === "care" && done ? <Pill tone="danger">Important</Pill> : null}
        {streaming && status ? (
          <span className="ml-auto truncate text-caption text-muted" aria-live="polite">
            {status}
          </span>
        ) : null}
      </header>

      {hasText ? (
        <div className="mt-2.5">
          <p className="text-pretty text-headline font-semibold text-ink">{card.headline}</p>
          {card.body ? <p className="mt-1.5 text-pretty text-body text-muted">{card.body}</p> : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="shimmer-ai h-4 w-4/5 rounded-full" />
          <div className="shimmer-ai h-4 w-3/5 rounded-full" />
        </div>
      )}

      {card.openNow ? (
        <div className="mt-3">
          <Pill tone={card.openNow.open ? "success" : "neutral"} pulse={card.openNow.open}>
            {card.openNow.label}
          </Pill>
        </div>
      ) : null}

      {card.facts && card.facts.length > 0 ? <Facts facts={card.facts} kind={card.kind} /> : null}
      {card.steps && card.steps.length > 0 ? <Steps steps={card.steps} /> : null}

      {card.events && card.events.length > 0 ? (
        <div className="mt-3.5 space-y-2.5">
          {card.events.map((e, i) => (
            <EventCard key={e.id} event={card.body && e.description && card.body.includes(e.description.slice(0, 40)) ? { ...e, description: null } : e} schoolName={schoolName} index={i} />
          ))}
        </div>
      ) : null}

      {streaming && hasText && !card.facts?.length && !card.steps?.length ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="shimmer-ai h-3 w-full rounded-full" />
          <div className="shimmer-ai h-3 w-2/3 rounded-full" />
        </div>
      ) : null}

      {card.handoff && done ? <Handoff card={card} onMessageStaff={onMessageStaff} /> : null}

      {done && card.citations && card.citations.length > 0 ? (
        <div className="mt-4">
          <p className="text-caption font-semibold text-muted">Answered from</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {card.citations.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenSources?.(card.citations ?? [], i)}
                  className="inline-flex min-h-9 max-w-[260px] items-center gap-1.5 rounded-[12px] bg-sunken px-2.5 text-left text-caption font-medium text-ink ring-1 ring-transparent transition hover:bg-accent-tint hover:ring-line"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  <span className="truncate">
                    {c.title}
                    {c.heading && c.heading !== c.title ? <span className="text-muted"> › {c.heading}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-caption text-muted">
            {SOURCE_LABEL[card.citations[0].sourceKind] ?? "School document"}
            {card.citations[0].updatedAt ? ` · updated ${new Date(card.citations[0].updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </p>
        </div>
      ) : null}

      {done && card.followUps && card.followUps.length > 0 && onFollowUp ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {card.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="min-h-9 rounded-full bg-accent-tint-2 px-3 text-label font-medium text-accent ring-1 ring-line-soft transition hover:bg-accent-tint active:scale-[0.97]"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {done && onFeedback && (outcome === "answered" || outcome === "unsure") ? (
        <footer className="mt-4 flex items-center gap-1 border-t border-line-soft pt-3">
          <span className="mr-auto text-caption text-muted">{feedback ? "Thanks for the feedback" : "Was this helpful?"}</span>
          <FeedbackButton label="Helpful" active={feedback === 1} onClick={() => onFeedback(1)}>
            {feedback === 1 ? <Check className="h-4 w-4" aria-hidden /> : <ThumbsUp className="h-4 w-4" aria-hidden />}
          </FeedbackButton>
          <FeedbackButton label="Not helpful" active={feedback === -1} onClick={() => onFeedback(-1)}>
            <ThumbsDown className="h-4 w-4" aria-hidden />
          </FeedbackButton>
          {onMessageStaff && outcome === "answered" ? (
            <button type="button" onClick={onMessageStaff} className="ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-label font-semibold text-accent hover:bg-accent-tint">
              <MessageSquare className="h-4 w-4" aria-hidden /> Ask staff
            </button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function FeedbackButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-full transition active:scale-90 ${active ? "bg-accent-tint text-accent" : "text-muted hover:bg-sunken hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Facts({ facts, kind }: { facts: NonNullable<AnswerCard["facts"]>; kind?: string }) {
  return (
    <dl className="mt-3.5 divide-y divide-line-soft overflow-hidden rounded-[14px] bg-accent-tint-2 ring-1 ring-line-soft">
      {facts.map((f, i) => (
        <div key={`${f.label}-${i}`} className="rise-in flex items-baseline justify-between gap-4 px-3.5 py-2.5" style={{ animationDelay: `${i * 40}ms` }}>
          <dt className="text-dense text-muted">{f.label}</dt>
          <dd className={`text-right text-dense font-semibold text-ink ${kind === "tuition" || kind === "hours" ? "tabular" : ""}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Steps({ steps }: { steps: NonNullable<AnswerCard["steps"]> }) {
  return (
    <ol className="mt-3.5 space-y-2">
      {steps.map((s, i) => (
        <li key={`${s.title}-${i}`} className="rise-in flex gap-3" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-tint text-caption font-bold text-accent tabular">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-dense font-semibold text-ink">{s.title}</p>
            {s.detail ? <p className="text-dense text-muted">{s.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Handoff({ card, onMessageStaff }: { card: Partial<AnswerCard>; onMessageStaff?: () => void }) {
  const h = card.handoff!;
  const care = card.outcome === "care";
  return (
    <div className={`mt-4 rounded-[14px] p-3.5 ${care ? "bg-danger-tint" : "bg-info-tint"}`}>
      <p className={`flex items-center gap-2 text-label font-semibold ${care ? "text-danger-ink" : "text-info-ink"}`}>
        {care ? <HeartHandshake className="h-4 w-4" aria-hidden /> : h.gapLogged ? <BookOpen className="h-4 w-4" aria-hidden /> : <Info className="h-4 w-4" aria-hidden />}
        {care ? "Help is a call away" : h.gapLogged ? "Need an answer sooner?" : "The front desk can help with this"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {h.phone ? (
          <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-label font-semibold ${care ? "bg-danger text-white" : "bg-surface text-ink ring-1 ring-line"}`}>
            <Phone className="h-4 w-4" aria-hidden /> {care ? "Call school" : "Call"}
          </a>
        ) : null}
        {onMessageStaff ? (
          <button type="button" onClick={onMessageStaff} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-3 text-label font-semibold text-on-accent hover:bg-accent-hover">
            <MessageSquare className="h-4 w-4" aria-hidden /> Message staff
          </button>
        ) : null}
      </div>
    </div>
  );
}
