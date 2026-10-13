"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Wallet, Thermometer, UtensilsCrossed, CalendarDays, Footprints, Stethoscope, ChevronRight, WifiOff, LogOut } from "lucide-react";
import Link from "next/link";
import type { AnswerCard, Citation } from "@/lib/schemas";
import { readAsk } from "@/lib/client/askStream";
import { useSpeechInput } from "@/lib/client/useSpeechInput";
import { speak, stopSpeaking } from "@/lib/client/speaker";
import { AskBar } from "@/components/parent/AskBar";
import { AnswerView } from "@/components/parent/AnswerView";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VoiceOverlay } from "@/components/parent/VoiceOverlay";
import { SourcesSheet } from "@/components/parent/SourcesSheet";
import { MessageStaffSheet } from "@/components/parent/MessageStaffSheet";
import { SickCheckSheet } from "@/components/parent/SickCheckSheet";
import { Avatar } from "@/components/ui/Avatar";
import { WheelMark } from "@/components/brand/WheelMark";
import { possessive } from "@/lib/text";

export interface AskSchool {
  name: string;
  shortName: string;
  tagline: string | null;
  phone: string | null;
  openNow: { open: boolean; label: string };
}
export interface AskParent {
  firstName: string;
  name: string;
  hue: number;
  child: { name: string; room: string } | null;
}

interface Turn {
  id: string;
  question: string;
  ack: string | null;
  status: string | null;
  card: Partial<AnswerCard>;
  streaming: boolean;
  messageId: string | null;
  feedback: 1 | -1 | null;
  error: string | null;
}

const CHIPS = [
  { label: "Hours", q: "What are your hours?", icon: Clock3, tint: "bg-accent-tint text-accent" },
  { label: "Tuition", q: "How much is tuition?", icon: Wallet, tint: "bg-success-tint text-success-ink" },
  { label: "Sick policy", q: "When should I keep my child home sick?", icon: Thermometer, tint: "bg-pink-tint text-pink-ink" },
  { label: "Meals", q: "What's for lunch this week?", icon: UtensilsCrossed, tint: "bg-orange-tint text-orange-ink" },
  { label: "Upcoming", q: "What events are coming up?", icon: CalendarDays, tint: "bg-teal-tint text-teal-ink" },
  { label: "Tours", q: "How do I book a tour?", icon: Footprints, tint: "bg-info-tint text-info-ink" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function AskApp({ school, parent, storageKey }: { school: AskSchool; parent: AskParent; storageKey: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<null | "listening" | "thinking" | "speaking">(null);
  const [voiceText, setVoiceText] = useState("");
  const [sources, setSources] = useState<{ citations: Citation[]; focus: number } | null>(null);
  const [staffFor, setStaffFor] = useState<string | null>(null);
  const [sickCheck, setSickCheck] = useState(false);
  const [offline, setOffline] = useState(false);
  const [hello, setHello] = useState("Hello");
  const conversationId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const voiceMode = useRef(false);

  // Restore the last few answers (also what makes the app useful offline).
  useEffect(() => {
    setHello(greeting());
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { turns: Turn[]; conversationId: string | null } | null;
      if (saved?.turns?.length) {
        setTurns(saved.turns.filter((t) => !t.streaming && !t.error));
        conversationId.current = saved.conversationId;
      }
    } catch {
      /* storage unavailable */
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [storageKey]);

  useEffect(() => {
    if (turns.some((t) => t.streaming)) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ turns: turns.slice(-12), conversationId: conversationId.current }));
    } catch {
      /* storage full or blocked */
    }
  }, [turns, storageKey]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  const patch = (id: string, fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const ask = useCallback(
    async (question: string, channel: "text" | "voice" | "guided" = "text") => {
      const q = question.trim();
      if (!q || busy) return;
      stopSpeaking();
      const id = crypto.randomUUID();
      setTurns((ts) => [...ts, { id, question: q, ack: null, status: null, card: {}, streaming: true, messageId: null, feedback: null, error: null }]);
      setInput("");
      setBusy(true);
      scrollToEnd();
      const ctrl = new AbortController();
      abort.current = ctrl;
      let final: AnswerCard | null = null;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q, conversationId: conversationId.current, channel }),
          signal: ctrl.signal,
        });
        if (res.status === 401) throw new Error("Your demo session ended. Go back to the start to pick a school.");
        if (!res.ok) throw new Error("I couldn't reach the front desk. Check your connection and try again.");
        for await (const ev of readAsk(res, ctrl.signal)) {
          if (ev.type === "start") conversationId.current = ev.conversationId;
          else if (ev.type === "ack") {
            patch(id, (t) => ({ ...t, ack: ev.text }));
            if (voiceMode.current) void speak(ev.text);
          } else if (ev.type === "status") patch(id, (t) => ({ ...t, status: ev.label }));
          else if (ev.type === "partial") patch(id, (t) => ({ ...t, card: { ...t.card, ...ev.card } }));
          else if (ev.type === "done") {
            final = ev.card;
            patch(id, (t) => ({ ...t, card: ev.card, streaming: false, status: null, messageId: ev.messageId }));
          } else if (ev.type === "error") throw new Error(ev.message);
        }
        if (!final) patch(id, (t) => ({ ...t, streaming: false }));
      } catch (e) {
        if ((e as Error).name === "AbortError") patch(id, (t) => ({ ...t, streaming: false, error: t.card.headline ? null : "Stopped." }));
        else patch(id, (t) => ({ ...t, streaming: false, error: e instanceof Error ? e.message : "Something went wrong." }));
      } finally {
        setBusy(false);
        abort.current = null;
        scrollToEnd();
      }
      if (voiceMode.current) {
        const card = final as AnswerCard | null;
        if (card) {
          setVoice("speaking");
          await speak([card.headline, card.body].filter(Boolean).join(" "));
        }
        voiceMode.current = false;
        setVoice(null);
      }
    },
    [busy, scrollToEnd],
  );

  const speech = useSpeechInput({
    onText: (t) => {
      setVoiceText(t);
      setInput(t);
    },
    onFinal: (t) => {
      if (voiceMode.current) {
        setVoice("thinking");
        void ask(t, "voice");
      }
    },
  });

  function startVoice() {
    stopSpeaking();
    voiceMode.current = true;
    setVoiceText("");
    setVoice("listening");
    speech.start();
  }
  function closeVoice() {
    voiceMode.current = false;
    speech.cancel();
    stopSpeaking();
    setVoice(null);
  }
  useEffect(() => {
    if (voice === "listening" && !speech.listening && speech.error) closeVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening, speech.error]);

  async function sendFeedback(turn: Turn, value: 1 | -1) {
    patch(turn.id, (t) => ({ ...t, feedback: value }));
    if (!turn.messageId) return;
    await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: turn.messageId, value }) }).catch(() => {});
  }

  const empty = turns.length === 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface shadow-1 ring-1 ring-line-soft">
          <WheelMark size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline font-semibold text-ink">{school.name}</p>
          <p className="flex items-center gap-1.5 text-caption text-muted">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${school.openNow.open ? "pulse-dot bg-success" : "bg-[var(--ink-placeholder)]"}`} style={{ color: "var(--success)" }} />
            Front Desk · {school.openNow.label}
          </p>
        </div>
        <ThemeToggle className="-mr-2" />
        <Link href="/" aria-label="Switch perspective" className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
          <LogOut className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      {offline ? (
        <div role="status" className="mx-4 mt-1 flex items-center gap-2 rounded-[12px] bg-warning-tint px-3 py-2 text-label font-medium text-warning-ink sm:mx-6">
          <WifiOff className="h-4 w-4" aria-hidden /> You&apos;re offline. Saved answers are still here; new questions send when you&apos;re back.
        </div>
      ) : null}

      <main className="flex-1 px-4 pb-40 sm:px-6" aria-live="polite" aria-relevant="additions">
        {empty ? (
          <section className="rise-in pt-6 sm:pt-10">
            <div className="flex items-center gap-3">
              <Avatar name={parent.name} hue={parent.hue} size={44} />
              <div>
                <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-display">
                  {hello}, {parent.firstName}
                </h1>
                {parent.child ? <p className="text-dense text-muted">{parent.child.name} · {parent.child.room}</p> : null}
              </div>
            </div>
            <p className="mt-5 text-pretty text-body text-muted">
              Ask anything about {school.shortName}. Answers come straight from the school&apos;s own handbook and calendar, and anything I&apos;m not sure about goes to the front desk.
            </p>

            <h2 className="mt-7 text-label font-semibold text-muted">Popular questions</h2>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {CHIPS.map((c, i) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => ask(c.q)}
                  className="rise-in group flex min-h-[72px] flex-col items-start justify-between rounded-[18px] bg-surface p-3.5 text-left shadow-1 ring-1 ring-line-soft transition hover:-translate-y-0.5 hover:shadow-2 active:scale-[0.98]"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-full ${c.tint}`}>
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="mt-2 text-dense font-semibold text-ink">{c.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSickCheck(true)}
              className="rise-in mt-3 flex w-full items-center gap-3.5 rounded-[18px] bg-surface p-4 text-left shadow-1 ring-1 ring-line-soft transition hover:shadow-2 active:scale-[0.99]"
              style={{ animationDelay: "150ms" }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pink-tint text-pink-ink">
                <Stethoscope className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline font-semibold text-ink">Can my child come in today?</span>
                <span className="block text-dense text-muted">A 20-second check against {possessive(school.shortName)} illness policy</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
            </button>
          </section>
        ) : (
          <ol className="space-y-5 pt-4">
            {turns.map((t) => (
              <li key={t.id} className="space-y-2.5">
                <div className="rise-in ml-auto w-fit max-w-[85%] rounded-[20px] rounded-br-md bg-accent px-4 py-2.5 text-body text-on-accent shadow-1">{t.question}</div>
                {t.ack && t.streaming && !t.card.headline ? <p className="fade-in pl-1 text-dense text-muted">{t.ack}</p> : null}
                {t.error ? (
                  <div role="alert" className="rounded-[16px] bg-danger-tint px-4 py-3 text-dense text-danger-ink">
                    {t.error}{" "}
                    {t.error !== "Stopped." ? (
                      <button type="button" className="font-semibold underline" onClick={() => ask(t.question)}>
                        Try again
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <AnswerView
                    card={t.card}
                    streaming={t.streaming}
                    status={t.status}
                    schoolName={school.name}
                    feedback={t.feedback}
                    onFeedback={(v) => sendFeedback(t, v)}
                    onFollowUp={(q) => ask(q)}
                    onOpenSources={(citations, focus) => setSources({ citations, focus })}
                    onMessageStaff={() => setStaffFor(t.question)}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-[720px] bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-4 pt-10 sm:px-6" style={{ paddingBottom: "max(14px, var(--safe-bottom))" }}>
          <div className="pointer-events-auto">
            {speech.error ? (
              <p role="alert" className="mb-2 rounded-[12px] bg-warning-tint px-3 py-2 text-label text-warning-ink">
                {speech.error}
              </p>
            ) : null}
            <AskBar
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={() => ask(input)}
              onMic={startVoice}
              micSupported={speech.supported}
              listening={speech.listening}
              busy={busy}
              onStop={() => abort.current?.abort()}
              placeholder={`Ask ${school.shortName} anything…`}
            />
            <p className="mt-2 text-center text-[11px] text-muted">AI answers from {possessive(school.shortName)} documents. Staff can always help.</p>
          </div>
        </div>
      </div>

      {voice ? <VoiceOverlay phase={voice} transcript={voiceText} onClose={closeVoice} /> : null}
      <SourcesSheet data={sources} onClose={() => setSources(null)} />
      <MessageStaffSheet open={staffFor !== null} about={staffFor} conversationId={conversationId.current} schoolName={school.shortName} onClose={() => setStaffFor(null)} />
      <SickCheckSheet
        open={sickCheck}
        onClose={() => setSickCheck(false)}
        childName={parent.child?.name ?? "your child"}
        onAsk={(q) => {
          setSickCheck(false);
          void ask(q, "guided");
        }}
      />
    </div>
  );
}
