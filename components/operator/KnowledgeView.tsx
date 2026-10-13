"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users, Pencil, Plus, Loader2, ArrowUpRight, ShieldCheck, Archive, RotateCcw, Sparkles, Send, ChevronLeft, FileText } from "lucide-react";
import { SearchBox } from "@/components/operator/InboxView";
import { MarkdownView } from "@/components/operator/MarkdownView";
import { BrandIcon, brandName } from "@/components/operator/BrandIcon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AnswerView } from "@/components/parent/AnswerView";
import type { AnswerCard } from "@/lib/schemas";
import { CATEGORY_LABEL, type PrivacyCategory } from "@/lib/schemas";
import Link from "next/link";

export interface DocItem {
  id: string;
  title: string;
  emoji: string | null;
  parent: string | null;
  visibility: "family" | "staff";
  archived: boolean;
  sourceKind: string;
  sourceLabel: string;
  updatedAt: string;
  held: number;
}

interface Detail {
  document: { id: string; title: string; content: string; url: string | null; visibility: "family" | "staff"; visibility_reason: string | null; visibility_set_by: string; status: string; sources: { kind: string } | null };
  findings: Array<{ id: string; category: PrivacyCategory; label: string; excerpt: string; status: string }>;
  chunks: number;
}

export function KnowledgeView({ docs, initialId }: { docs: DocItem[]; initialId: string | null }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(initialId ?? docs.find((d) => d.visibility === "family" && !d.archived)?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(Boolean(initialId));
  const [creating, setCreating] = useState(false);
  const [tester, setTester] = useState(false);

  const groups = useMemo(() => {
    const filtered = docs.filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase()));
    const map = new Map<string, { label: string; kind: string; docs: DocItem[] }>();
    for (const d of filtered) {
      const g = map.get(d.sourceLabel) ?? { label: d.sourceLabel, kind: d.sourceKind, docs: [] };
      g.docs.push(d);
      map.set(d.sourceLabel, g);
    }
    return [...map.values()];
  }, [docs, q]);
  const familyCount = docs.filter((d) => d.visibility === "family" && !d.archived).length;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-display">Knowledge</h1>
          <p className="mt-1 text-dense text-muted sm:text-body">
            Your source of truth. <span className="font-semibold text-ink">{familyCount}</span> pages families can search, <span className="font-semibold text-ink">{docs.length - familyCount}</span> staff-only or archived.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTester(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-dense font-semibold text-ink shadow-1 ring-1 ring-line hover:bg-sunken">
            <Sparkles className="h-4 w-4 text-ai-ink" aria-hidden /> Ask a test question
          </button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-dense font-semibold text-on-accent shadow-1 hover:bg-accent-hover">
            <Plus className="h-4 w-4" aria-hidden /> New page
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <nav aria-label="Pages" className="rounded-[16px] bg-surface p-3 shadow-1 ring-1 ring-line-soft lg:sticky lg:top-6 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto">
          <SearchBox value={q} onChange={setQ} placeholder="Find a page" />
          {groups.map((g) => (
            <div key={g.label} className="mt-4">
              <p className="flex items-center gap-2 px-2 text-caption font-semibold text-muted">
                <BrandIcon kind={g.kind} size={20} /> <span className="truncate">{g.label}</span>
              </p>
              <ul className="ml-[17px] mt-1.5 space-y-0.5 border-l border-line-soft pl-2">
                {g.docs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(d.id);
                        setMobileOpen(true);
                      }}
                      aria-current={selected === d.id ? "page" : undefined}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-[10px] px-2 text-left text-dense transition ${selected === d.id ? "bg-accent-tint font-semibold text-accent" : "text-ink hover:bg-sunken"} ${d.archived ? "text-muted line-through decoration-1" : ""}`}
                    >
                      <span className="w-5 shrink-0 text-center" aria-hidden>
                        {d.emoji ?? "📄"}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      {d.held ? <ShieldCheck className="h-4 w-4 shrink-0 text-warning-ink" aria-label={`${d.held} held`} /> : null}
                      {d.visibility === "staff" ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Staff only" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden lg:block">{selected ? <DocPane id={selected} /> : null}</div>
      </div>

      <div className="lg:hidden">
        <Sheet open={mobileOpen && selected !== null} onOpenChange={setMobileOpen} title={docs.find((d) => d.id === selected)?.title ?? "Page"} side="bottom" snapPoints={[0.9]}>
          {selected ? <DocPane id={selected} embedded /> : null}
        </Sheet>
      </div>

      <NewPageSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => setSelected(id)} />
      <TesterSheet open={tester} onClose={() => setTester(false)} />
    </div>
  );
}

function DocPane({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ key: string; data: Detail } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const key = `${id}:${rev}`;
  const data = loaded?.key === key ? loaded.data : null;
  const editing = editingKey === key;
  const setEditing = (on: boolean) => setEditingKey(on ? key : null);
  useEffect(() => {
    let live = true;
    fetch(`/api/operator/documents/${id}`)
      .then((r) => r.json())
      .then((j) => live && setLoaded({ key: `${id}:${rev}`, data: j }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, rev]);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    const res = await fetch(`/api/operator/documents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't save. Try again." });
    if (body.content !== undefined) toast({ tone: "success", title: "Saved. Families get the new version now.", body: j.held ? `Privacy Guard held ${j.held} new detail${j.held > 1 ? "s" : ""}.` : undefined });
    else if (body.visibility) toast({ tone: "success", title: body.visibility === "family" ? "Families can search this page now" : "Now staff-only. Removed from family answers." });
    else toast({ tone: "success", title: body.status === "archived" ? "Archived" : "Restored" });
    setEditing(false);
    setRev((r) => r + 1);
    router.refresh();
  }

  if (!data) {
    return (
      <div className={embedded ? "" : "rounded-[16px] bg-surface p-8 shadow-1 ring-1 ring-line-soft"} aria-busy="true" aria-label="Loading page">
        <div className="flex items-center gap-2 border-b border-line-soft pb-3">
          <div className="shimmer h-9 w-56 rounded-full" />
          <div className="shimmer ml-auto h-9 w-24 rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          <div className="shimmer h-7 w-2/3 rounded-full" />
          <div className="shimmer h-4 w-full rounded-full" />
          <div className="shimmer h-4 w-11/12 rounded-full" />
          <div className="shimmer h-4 w-4/6 rounded-full" />
        </div>
        <div className="mt-8 space-y-3">
          <div className="shimmer h-5 w-1/2 rounded-full" />
          <div className="shimmer h-4 w-full rounded-full" />
          <div className="shimmer h-4 w-5/6 rounded-full" />
          <div className="shimmer h-4 w-full rounded-full" />
          <div className="shimmer h-4 w-3/5 rounded-full" />
        </div>
      </div>
    );
  }
  const d = data.document;
  const held = data.findings.filter((f) => f.status === "held");
  const synced = d.sources && !["manual", "upload"].includes(d.sources.kind);

  return (
    <article className={embedded ? "" : "rounded-[16px] bg-surface shadow-1 ring-1 ring-line-soft"}>
      <div className={`flex flex-wrap items-center gap-2 border-b border-line-soft ${embedded ? "pb-3" : "px-6 py-3"}`}>
        <div role="radiogroup" aria-label="Who can see this page" className="inline-flex rounded-full bg-sunken p-1">
          {(["family", "staff"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={d.visibility === v}
              disabled={!!busy || d.visibility === v}
              onClick={() => patch({ visibility: v }, "vis")}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-label font-semibold transition ${d.visibility === v ? (v === "family" ? "bg-surface text-success-ink shadow-1" : "bg-surface text-ink shadow-1") : "text-muted hover:text-ink"}`}
            >
              {v === "family" ? <Users className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
              {v === "family" ? "Family-visible" : "Staff-only"}
            </button>
          ))}
        </div>
        {busy === "vis" ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
        <span className="text-caption text-muted">{d.visibility === "family" ? `${data.chunks} searchable passages` : "Not searchable by families"}</span>
        <div className="ml-auto flex items-center gap-1">
          {d.url && !d.url.includes("/demo/") ? (
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-label font-semibold text-muted hover:bg-sunken hover:text-ink">
              {d.sources && brandName(d.sources.kind) ? <BrandIcon kind={d.sources.kind} size={16} bare /> : null}
              Open in {(d.sources && brandName(d.sources.kind)) ?? "original"}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
          <button type="button" onClick={() => patch({ status: d.status === "archived" ? "active" : "archived" }, "arch")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-label font-semibold text-muted hover:bg-sunken hover:text-ink">
            {d.status === "archived" ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
            {d.status === "archived" ? "Restore" : "Archive"}
          </button>
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(d.content);
                setEditing(true);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-tint px-3.5 text-label font-semibold text-accent hover:brightness-95"
            >
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </button>
          ) : null}
        </div>
      </div>

      {d.visibility_reason && d.visibility === "staff" && d.visibility_set_by === "auto" ? (
        <p className={`flex items-start gap-2 bg-warning-tint text-dense text-warning-ink ${embedded ? "mt-3 rounded-[12px] p-3" : "px-6 py-3"}`}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Privacy Guard kept this staff-only. {d.visibility_reason}
        </p>
      ) : null}
      {held.length && d.visibility === "family" ? (
        <Link href="/operator/privacy" className={`flex items-start gap-2 bg-warning-tint text-dense text-warning-ink hover:underline ${embedded ? "mt-3 rounded-[12px] p-3" : "px-6 py-3"}`}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {held.length} detail{held.length > 1 ? "s are" : " is"} held from families until you review {held.length > 1 ? "them" : "it"}: {[...new Set(held.map((f) => CATEGORY_LABEL[f.category] ?? f.label))].join(", ").toLowerCase()}.
        </Link>
      ) : null}

      <div className={embedded ? "pt-4" : "px-6 py-5 sm:px-10 sm:py-8"}>
        {editing ? (
          <div>
            {synced ? (
              <p className="mb-3 rounded-[12px] bg-info-tint p-3 text-caption text-info-ink">
                This page syncs from {d.sources?.kind === "drive" ? "Google Drive" : d.sources?.kind === "notion" ? "Notion" : "your calendar"}. Your edit is used right away; if the original changes later, the next sync brings that version in.
              </p>
            ) : null}
            <label htmlFor="doc-editor" className="sr-only">
              Page content (Markdown)
            </label>
            <textarea id="doc-editor" value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[52dvh] w-full resize-y rounded-[12px] bg-canvas p-4 font-mono text-[14px] leading-6 text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-full px-4 text-dense font-semibold text-muted hover:bg-sunken">
                Cancel
              </button>
              <button type="button" disabled={busy === "save"} onClick={() => patch({ content: draft }, "save")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-dense font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Save and update answers
              </button>
            </div>
          </div>
        ) : (
          <MarkdownView content={d.content} marks={data.findings.map((f) => ({ text: f.excerpt, status: f.status, label: CATEGORY_LABEL[f.category] ?? f.label }))} />
        )}
      </div>
    </article>
  );
}

function NewPageSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setContent("");
    }
  }
  async function create() {
    setBusy(true);
    const res = await fetch("/api/operator/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, content: `# ${title}\n\n${content}` }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't create the page." });
    toast({ tone: "success", title: "Page published", body: j.held ? `Privacy Guard held ${j.held} detail${j.held > 1 ? "s" : ""} for review.` : "Families can ask about it now." });
    onCreated(j.documentId);
    onClose();
    router.refresh();
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New page"
      description="Write it once. Privacy Guard checks it, and families can ask about it right away."
      snapPoints={[0.92]}
      footer={
        <button type="button" disabled={busy || !title.trim()} onClick={create} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-dense font-semibold text-on-accent disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />} Publish page
        </button>
      }
    >
      <label className="block">
        <span className="text-label font-semibold text-ink">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Parking and drop-off" className="mt-1.5 h-11 w-full rounded-[10px] bg-surface px-3.5 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
      </label>
      <label className="mt-4 block">
        <span className="text-label font-semibold text-ink">Content</span>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Plain sentences work best. Use - for lists." className="mt-1.5 w-full rounded-[12px] bg-surface p-3.5 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
      </label>
    </Sheet>
  );
}

function TesterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [card, setCard] = useState<AnswerCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(question = q) {
    if (!question.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/operator/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error ?? "No answer.");
    setCard(j.card);
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Ask a test question" description="See exactly what a parent would get. Nothing is saved or counted." snapPoints={[0.92]} width={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex gap-2"
      >
        <label htmlFor="tester-q" className="sr-only">
          Test question
        </label>
        <input id="tester-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Is there parking for drop off?" className="h-12 min-w-0 flex-1 rounded-full bg-surface px-4 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
        <button type="submit" aria-label="Ask" disabled={busy || !q.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["What are your hours?", "Is my kid too sick to come in with a fever?", "What's the door code?"].map((s) => (
          <button key={s} type="button" onClick={() => { setQ(s); void run(s); }} className="min-h-9 rounded-full bg-accent-tint-2 px-3 text-label text-accent ring-1 ring-line-soft">
            {s}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {err ? <p role="alert" className="text-dense text-danger-ink">{err}</p> : null}
        {busy && !card ? <AnswerView card={{}} streaming status="Checking…" schoolName="" /> : null}
        {card ? <AnswerView card={card} streaming={false} schoolName="" /> : null}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-caption text-muted">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Edit a page, save, and ask again to see the change.
      </p>
    </Sheet>
  );
}
