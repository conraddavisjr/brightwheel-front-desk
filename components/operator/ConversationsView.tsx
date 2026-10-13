"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp, Send, Loader2, Sparkles, FileText, Mic, MessageCircleReply } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { SearchBox } from "@/components/operator/InboxView";
import { OUTCOME_PILL } from "@/components/operator/labels";
import { ago } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";

export interface Thread {
  id: string;
  parent: { id: string; name: string; hue: number; child: { name: string; room: string } | null } | null;
  lastQuestion: string;
  lastAt: string;
  outcome: string | null;
  feedback: number | null;
  needsReply: boolean;
  messages: Array<{ id: string; role: "parent" | "assistant" | "staff"; text: string; outcome: string | null; feedback: number | null; citations: string[]; at: string; toStaff: boolean }>;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "reply", label: "Needs a reply" },
  { id: "down", label: "Rated not helpful" },
  { id: "unsure", label: "No answer" },
] as const;

export function ConversationsView({ threads, initialQuery = "", initialFilter = "all" }: { threads: Thread[]; initialQuery?: string; initialFilter?: (typeof FILTERS)[number]["id"] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(initialFilter);
  const [q, setQ] = useState(initialQuery);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(
    () =>
      threads.filter((t) => {
        if (filter === "reply" && !t.needsReply) return false;
        if (filter === "down" && t.feedback !== -1) return false;
        if (filter === "unsure" && t.outcome !== "unsure") return false;
        if (q && !(`${t.parent?.name ?? ""} ${t.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q.toLowerCase()))) return false;
        return true;
      }),
    [threads, filter, q],
  );
  const current = threads.find((t) => t.id === openId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => {
            const n = f.id === "all" ? threads.length : threads.filter((t) => (f.id === "reply" ? t.needsReply : f.id === "down" ? t.feedback === -1 : t.outcome === "unsure")).length;
            return (
              <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`min-h-10 shrink-0 rounded-full px-3.5 text-label font-semibold ring-1 transition ${filter === f.id ? "bg-ink text-surface ring-ink" : "bg-surface text-muted ring-line-soft hover:text-ink"}`}>
                {f.label} <span className="tabular">{n}</span>
              </button>
            );
          })}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search families or questions" />
      </div>

      <ul className="overflow-hidden rounded-[16px] bg-surface shadow-1 ring-1 ring-line-soft">
        {list.slice(0, 80).map((t) => (
          <li key={t.id} className="border-b border-line-soft last:border-0">
            <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-tint-2">
              <Avatar name={t.parent?.name ?? "Guest"} hue={t.parent?.hue ?? 230} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-dense font-semibold text-ink">{t.parent?.name ?? "Guest"}</span>
                  {t.parent?.child ? <span className="hidden truncate text-caption text-muted sm:inline">{t.parent.child.name} · {t.parent.child.room}</span> : null}
                  <span className="ml-auto shrink-0 text-caption text-muted">{ago(t.lastAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-dense text-muted">{t.lastQuestion}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-2 sm:flex">
                {t.needsReply ? <Pill tone="accent">Needs reply</Pill> : t.outcome ? <Pill tone={OUTCOME_PILL[t.outcome]?.tone ?? "neutral"}>{OUTCOME_PILL[t.outcome]?.label}</Pill> : null}
                {t.feedback === 1 ? <ThumbsUp className="h-4 w-4 text-success-ink" aria-label="Rated helpful" /> : t.feedback === -1 ? <ThumbsDown className="h-4 w-4 text-danger-ink" aria-label="Rated not helpful" /> : <span className="w-4" />}
              </span>
              {t.needsReply ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent sm:hidden" aria-label="Needs reply" /> : null}
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className="p-8 text-center text-dense text-muted">No conversations match.</li> : null}
      </ul>
      {list.length > 80 ? <p className="text-center text-caption text-muted">Showing the 80 most recent of {list.length}.</p> : null}

      <ThreadSheet thread={current} onClose={() => setOpenId(null)} />
    </>
  );
}

function ThreadSheet({ thread, onClose }: { thread: Thread | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!thread?.parent || !text.trim()) return;
    setBusy(true);
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, conversationId: thread.id, toParentId: thread.parent.id }) });
    setBusy(false);
    if (!res.ok) return toast({ tone: "danger", title: "That didn't send. Try again." });
    toast({ tone: "success", title: `Sent to ${thread.parent.name.split(" ")[0]}`, body: "They'll see it in the brightwheel app. (Delivery is simulated in this demo.)" });
    setText("");
    onClose();
    router.refresh();
  }
  return (
    <Sheet
      open={thread !== null}
      onOpenChange={(o) => !o && onClose()}
      title={thread?.parent?.name ?? "Conversation"}
      description={thread?.parent?.child ? `${thread.parent.child.name}'s family · ${thread.parent.child.room}` : undefined}
      snapPoints={[0.92]}
      width={560}
      footer={
        thread?.parent ? (
          <div className="flex items-end gap-2">
            <label htmlFor="reply" className="sr-only">
              Reply to {thread.parent.name}
            </label>
            <textarea id="reply" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={`Write to ${thread.parent.name.split(" ")[0]}…`} className="min-h-12 flex-1 resize-none rounded-[16px] bg-surface px-4 py-3 text-dense text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
            <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Send reply" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-50">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        ) : null
      }
    >
      <ol className="space-y-3">
        {thread?.messages.map((m) => (
          <li key={m.id} className={m.role === "parent" ? "flex justify-end" : ""}>
            {m.role === "parent" ? (
              <div className="max-w-[85%]">
                {m.toStaff ? (
                  <p className="mb-1 flex items-center justify-end gap-1 text-caption font-semibold text-accent">
                    <MessageCircleReply className="h-3.5 w-3.5" aria-hidden /> To staff
                  </p>
                ) : null}
                <div className={`rounded-[18px] rounded-br-md px-3.5 py-2 text-dense ${m.toStaff ? "bg-accent-tint text-ink ring-1 ring-accent/30" : "bg-accent text-on-accent"}`}>{m.text}</div>
                <p className="mt-1 text-right text-caption text-muted">{new Date(m.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
            ) : m.role === "staff" ? (
              <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-success-tint px-3.5 py-2 text-dense text-ink">
                <p className="mb-0.5 text-caption font-semibold text-success-ink">You replied</p>
                {m.text}
              </div>
            ) : (
              <div className="ai-edge overflow-hidden rounded-[16px] bg-surface p-3.5 ring-1 ring-line-soft">
                <p className="flex items-center gap-1.5 text-caption font-semibold text-ai-ink">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Front Desk
                  {m.outcome ? <Pill tone={OUTCOME_PILL[m.outcome]?.tone ?? "neutral"} className="ml-1">{OUTCOME_PILL[m.outcome]?.label}</Pill> : null}
                  {m.feedback === 1 ? <ThumbsUp className="ml-auto h-4 w-4 text-success-ink" aria-label="Rated helpful" /> : m.feedback === -1 ? <ThumbsDown className="ml-auto h-4 w-4 text-danger-ink" aria-label="Rated not helpful" /> : null}
                </p>
                <p className="mt-1.5 text-dense text-ink">{m.text}</p>
                {m.citations.length ? (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-caption text-muted">
                    <FileText className="h-3.5 w-3.5 text-accent" aria-hidden /> {m.citations.join(" · ")}
                  </p>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-1.5 text-caption text-muted">
        <Mic className="h-3.5 w-3.5" aria-hidden /> Families see that answers come from Front Desk, and can always reach a person.
      </p>
    </Sheet>
  );
}
