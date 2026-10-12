"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileWarning, Loader2, MessageCircleQuestion, Mail, Archive, Undo2, Search, X, Sparkles, FileText } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { TOPIC_LABEL } from "@/components/operator/labels";
import { ago } from "@/components/operator/IntegrationTiles";
import { useToast } from "@/components/ui/Toast";

export interface GapItem {
  id: string;
  question: string;
  topic: string;
  kind: "question" | "conflict";
  note: string | null;
  status: "open" | "answered" | "dismissed";
  ask_count: number;
  asker_ids: string[];
  first_asked_at: string;
  last_asked_at: string;
  answer: string | null;
  answered_at: string | null;
  notified_at: string | null;
  askers: Array<{ id: string; name: string; hue: number }>;
  documents: Array<{ id: string; title: string; updatedAt: string | null; archived: boolean; outdated?: boolean }>;
}

const TABS = [
  { id: "open", label: "Needs an answer" },
  { id: "answered", label: "Answered" },
  { id: "dismissed", label: "Dismissed" },
] as const;

export function InboxView({ items, focusId }: { items: GapItem[]; focusId: string | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("open");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(focusId);
  const visible = useMemo(
    () => items.filter((g) => g.status === tab && (!q || g.question.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (a.kind === "conflict" ? -1 : 0) - (b.kind === "conflict" ? -1 : 0) || b.ask_count - a.ask_count),
    [items, tab, q],
  );
  const current = items.find((g) => g.id === openId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Filter" className="inline-flex rounded-full bg-surface p-1 shadow-1 ring-1 ring-line-soft">
          {TABS.map((t) => {
            const n = items.filter((g) => g.status === t.id).length;
            return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-9 rounded-full px-3.5 text-label font-semibold transition ${tab === t.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}>
                {t.label} <span className="tabular">{n}</span>
              </button>
            );
          })}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search questions" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-10 text-center shadow-1 ring-1 ring-line-soft">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
          <p className="mt-3 text-headline font-semibold text-ink">{tab === "open" ? "All caught up" : "Nothing here yet"}</p>
          <p className="mt-1 text-dense text-muted">{tab === "open" ? "When a family asks something your documents don't cover, it shows up here." : "Items move here as you work through the inbox."}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setOpenId(g.id)} className="group flex w-full items-start gap-3.5 rounded-[16px] bg-surface p-4 text-left shadow-1 ring-1 ring-line-soft transition hover:-translate-y-0.5 hover:shadow-2">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${g.kind === "conflict" ? "bg-orange-tint text-orange-ink" : "bg-accent-tint text-accent"}`}>
                  {g.kind === "conflict" ? <FileWarning className="h-5 w-5" aria-hidden /> : <MessageCircleQuestion className="h-5 w-5" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {g.kind === "conflict" ? <Pill tone="orange">Documents disagree</Pill> : <Pill tone="neutral" dot={false}>{TOPIC_LABEL[g.topic] ?? g.topic}</Pill>}
                    <span className="text-caption text-muted">last asked {ago(g.last_asked_at)}</span>
                  </span>
                  <span className="mt-1.5 block text-headline font-semibold text-ink">{g.kind === "conflict" ? g.note : `“${g.question}”`}</span>
                  {g.kind === "conflict" ? <span className="mt-0.5 block text-dense text-muted">Families asking &ldquo;{g.question}&rdquo; may get a hedged answer until this is fixed.</span> : null}
                  {g.status === "answered" && g.answer ? <span className="mt-1 line-clamp-1 block text-dense text-muted">{g.answer}</span> : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tabular text-headline font-bold text-ink">{g.ask_count}×</span>
                  <span className="flex -space-x-2">
                    {g.askers.slice(0, 3).map((a) => (
                      <Avatar key={a.id} name={a.name} hue={a.hue} size={24} className="ring-2 ring-surface" />
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <GapSheet gap={current} onClose={() => setOpenId(null)} />
    </>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-full bg-surface pl-10 pr-10 text-dense text-ink shadow-1 ring-1 ring-line-soft outline-none placeholder:text-placeholder focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="pop-in absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function titleFrom(q: string): string {
  const t = q.replace(/[?.!]+$/, "").replace(/^(do|does|is|are|can|could|will|what|when|where|how)\s+(you|there|i|we)?\s*/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function GapSheet({ gap, onClose }: { gap: GapItem | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [relatedFor, setRelatedFor] = useState<{ id: string; items: Array<{ documentId: string; title: string; heading: string; excerpt: string }> } | null>(null);
  const related = relatedFor && gap && relatedFor.id === gap.id ? relatedFor.items : null;

  // A different gap opened: reset the form during render (not in an effect).
  const [shown, setShown] = useState<string | null>(null);
  if ((gap?.id ?? null) !== shown) {
    setShown(gap?.id ?? null);
    if (gap) {
      setTitle(titleFrom(gap.question));
      setAnswer(gap.answer ?? "");
      setNotify(true);
    }
  }

  useEffect(() => {
    if (!gap || gap.kind !== "question") return;
    let live = true;
    fetch(`/api/operator/gaps/${gap.id}`)
      .then((r) => r.json())
      .then((j) => live && setRelatedFor({ id: gap.id, items: j.related ?? [] }))
      .catch(() => live && setRelatedFor({ id: gap.id, items: [] }));
    return () => {
      live = false;
    };
  }, [gap]);

  async function act(body: Record<string, unknown>, label: string) {
    if (!gap) return;
    setBusy(label);
    const res = await fetch(`/api/operator/gaps/${gap.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast({ tone: "danger", title: json.error ?? "That didn't work. Try again." });
    if (body.action === "answer") {
      toast({
        tone: "success",
        title: "Published. Front Desk can answer this now.",
        body: json.held ? `Privacy Guard held ${json.held} detail${json.held > 1 ? "s" : ""} in your answer for review.` : json.notified ? `We'd email the ${json.notified} famil${json.notified > 1 ? "ies" : "y"} who asked. (Email is simulated in this demo.)` : undefined,
      });
    } else if (body.action === "archive_document") toast({ tone: "success", title: "Archived. Only the current document is used now." });
    else toast({ tone: "neutral", title: body.action === "dismiss" ? "Dismissed" : "Reopened" });
    onClose();
    router.refresh();
  }

  const open = gap !== null;
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={gap?.kind === "conflict" ? "Two documents disagree" : "Answer for families"}
      description={gap ? (gap.kind === "conflict" ? gap.note ?? undefined : `Asked ${gap.ask_count}× · first ${ago(gap.first_asked_at)}`) : undefined}
      snapPoints={[0.92]}
      width={560}
      footer={
        gap && gap.kind === "question" && gap.status !== "answered" ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => act({ action: "dismiss" }, "dismiss")} disabled={!!busy} className="min-h-12 rounded-full px-4 text-dense font-semibold text-muted hover:bg-sunken">
              Dismiss
            </button>
            <button
              type="button"
              disabled={!!busy || answer.trim().length < 2 || title.trim().length < 2}
              onClick={() => act({ action: "answer", title, answer, notify }, "answer")}
              className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-dense font-semibold text-on-accent shadow-1 hover:bg-accent-hover disabled:opacity-60"
            >
              {busy === "answer" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              Publish answer
            </button>
          </div>
        ) : gap && gap.status !== "open" ? (
          <button type="button" onClick={() => act({ action: "reopen" }, "reopen")} className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-dense font-semibold text-accent hover:bg-accent-tint">
            <Undo2 className="h-4 w-4" aria-hidden /> Reopen
          </button>
        ) : null
      }
    >
      {gap?.kind === "question" ? (
        <div className="space-y-5">
          <blockquote className="rounded-[16px] bg-accent-tint-2 p-4 text-headline font-semibold text-ink ring-1 ring-line-soft">&ldquo;{gap.question}&rdquo;</blockquote>
          {gap.askers.length ? (
            <div>
              <p className="text-label font-semibold text-muted">Asked by</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {gap.askers.map((a) => (
                  <li key={a.id} className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-label font-medium text-ink ring-1 ring-line-soft">
                    <Avatar name={a.name} hue={a.hue} size={24} /> {a.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="flex items-center gap-1.5 text-label font-semibold text-muted">
              <Sparkles className="h-3.5 w-3.5 text-ai-ink" aria-hidden /> Closest match in your documents
            </p>
            {related === null ? (
              <div className="shimmer mt-2 h-16 rounded-[12px]" />
            ) : related.length === 0 ? (
              <p className="mt-2 text-dense text-muted">Nothing related. This is new information for Front Desk.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {related.slice(0, 2).map((r) => (
                  <li key={r.documentId + r.heading} className="rounded-[12px] bg-sunken p-3">
                    <p className="flex items-center gap-1.5 text-caption font-semibold text-ink">
                      <FileText className="h-3.5 w-3.5 text-accent" aria-hidden /> {r.title}
                      {r.heading ? <span className="font-normal text-muted"> › {r.heading}</span> : null}
                    </p>
                    <p className="mt-1 line-clamp-2 text-caption text-muted">{r.excerpt}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-caption text-muted">Front Desk didn&apos;t treat these as an answer. We never draft policy for you; your words become the source.</p>
          </div>

          {gap.status === "answered" ? (
            <div className="rounded-[16px] bg-success-tint p-4">
              <p className="text-label font-semibold text-success-ink">Your answer</p>
              <p className="mt-1 whitespace-pre-line text-dense text-ink">{gap.answer}</p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-label font-semibold text-ink">Page title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1.5 h-11 w-full rounded-[10px] bg-surface px-3.5 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
              </label>
              <label className="block">
                <span className="text-label font-semibold text-ink">Answer, in your words</span>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  placeholder="Write it the way you'd say it at the front desk. Include times, prices and who to contact."
                  className="mt-1.5 w-full resize-y rounded-[12px] bg-surface p-3.5 text-body text-ink ring-1 ring-line-strong outline-none placeholder:text-placeholder focus:ring-2 focus:ring-accent"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ring-1 ring-line-soft">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  <span className="flex items-center gap-1.5 text-dense font-semibold text-ink">
                    <Mail className="h-4 w-4 text-accent" aria-hidden /> Let the {gap.askers.length || gap.ask_count} {gap.askers.length === 1 ? "family" : "families"} who asked know
                  </span>
                  <span className="block text-caption text-muted">They get your answer by email and in the brightwheel app. Demo note: delivery is simulated here; in production this uses brightwheel messaging.</span>
                </span>
              </label>
            </>
          )}
        </div>
      ) : gap ? (
        <div className="space-y-4">
          <p className="text-dense text-muted">
            Families asked: <span className="font-semibold text-ink">&ldquo;{gap.question}&rdquo;</span>. Until one version is retired, Front Desk uses the newer document and tells families the school is confirming.
          </p>
          <ul className="space-y-2.5">
            {gap.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 ring-1 ring-line-soft">
                <FileText className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-dense font-semibold text-ink">
                    <span className="truncate">{d.title}</span>
                    {d.outdated && !d.archived ? <Pill tone="orange">Looks outdated</Pill> : null}
                  </p>
                  <p className="text-caption text-muted">{d.archived ? "Archived" : d.updatedAt ? `Updated ${new Date(d.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "In use"}</p>
                </div>
                {d.archived ? (
                  <Pill tone="neutral">Archived</Pill>
                ) : gap.status === "open" ? (
                  <button type="button" disabled={!!busy} onClick={() => act({ action: "archive_document", documentId: d.id }, d.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-orange-tint px-3.5 text-label font-semibold text-orange-ink hover:brightness-95 disabled:opacity-60">
                    {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />} Retire this one
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted">Retiring removes it from what families can search. You can restore it from Knowledge any time.</p>
        </div>
      ) : null}
    </Sheet>
  );
}
