"use client";

import { useId, useRef, useState } from "react";
import { CategoryPicker } from "@/components/operator/CategoryPicker";
import { useRouter } from "next/navigation";
import { ShieldCheck, EyeOff, Lock, Check, Plus, Loader2, FileText, Sparkles, History, Users, ChevronRight, ArrowUpRight } from "lucide-react";
import { Pill, type Tone } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { BrandIcon, brandName } from "@/components/operator/BrandIcon";
import { ago } from "@/lib/time";
import { CATEGORY_LABEL, type PrivacyCategory } from "@/lib/schemas";

export interface HeldItem {
  id: string;
  documentId: string;
  documentTitle: string;
  /** The original in Notion or Drive, when there is one. */
  documentUrl: string | null;
  sourceKind: string;
  category: string;
  label: string;
  reason: string;
  detector: string;
  before: string;
  match: string;
  after: string;
}
export interface QuarantinedDoc {
  id: string;
  title: string;
  url: string | null;
  reason: string | null;
  sourceKind: string;
  count: number;
  categories: string[];
}
export interface RuleItem {
  id: string;
  name: string;
  description: string;
  category: string;
  pattern: string | null;
  preset: boolean;
  enabled: boolean;
  basis: string | null;
  matches: number;
}
export interface LogItem {
  id: string;
  action: string;
  detail: Record<string, unknown>;
  at: string;
  actor: string;
}

const CAT_TONE: Record<string, Tone> = {
  child_record: "pink",
  family_safety: "danger",
  health_record: "pink",
  staff_hr: "orange",
  financial: "orange",
  facility_security: "warning",
  embargoed: "ai",
  credentials: "warning",
  personal_contact: "info",
  custom: "accent",
};

const TABS = ["review", "documents", "rules", "log"] as const;

const ACTION_LABEL: Record<string, string> = {
  "privacy.redact": "Redacted",
  "privacy.staff_only": "Kept staff-only",
  "privacy.dismiss": "Marked fine to share",
  "privacy.rule.add": "Added a rule",
  "privacy.rule.enable": "Turned on a rule",
  "privacy.rule.disable": "Turned off a rule",
  "document.visibility": "Changed who can see a page",
  "document.edit": "Edited a page",
  "document.create": "Created a page",
  "document.archive": "Retired an outdated page",
  "document.status": "Archived or restored a page",
  "gap.answer": "Answered a family question",
  "gap.dismiss": "Dismissed a question",
  "gap.reopen": "Reopened a question",
  "source.sync": "Synced a source",
  "source.connect": "Connected a source",
  "source.upload": "Uploaded a file",
};

export function PrivacyView({ held, quarantined, rules, log, protectedCount }: { held: HeldItem[]; quarantined: QuarantinedDoc[]; rules: RuleItem[]; log: LogItem[]; protectedCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("review");
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const visibleHeld = held.filter((h) => !gone.has(h.id));
  const visibleDocs = quarantined.filter((d) => !gone.has(d.id));

  async function review(ids: string[], action: "redact" | "staff_only" | "dismiss") {
    setBusy(ids.length > 1 ? "bulk" : ids[0]);
    const res = await fetch(`/api/operator/findings/${ids.length > 1 ? "bulk" : ids[0]}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ids }) });
    setBusy(null);
    if (!res.ok) return toast({ tone: "danger", title: "That didn't save. Try again." });
    setGone((g) => new Set([...g, ...ids]));
    toast({
      tone: "success",
      title: action === "redact" ? "Redacted. Your redaction list is updated." : action === "staff_only" ? "Kept for staff only" : "Marked fine to share",
      body: action === "dismiss" ? "Families can now get answers that include it." : "Front Desk will never include it in a family answer.",
    });
    router.refresh();
  }
  async function decideDoc(id: string, visibility: "family" | "staff") {
    setBusy(id);
    const res = await fetch(`/api/operator/documents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility }) });
    setBusy(null);
    if (!res.ok) return toast({ tone: "danger", title: "That didn't save." });
    setGone((g) => new Set([...g, id]));
    toast({ tone: "success", title: visibility === "staff" ? "Confirmed staff-only" : "Families can search this page now", body: visibility === "family" ? "Specific details Privacy Guard found are still held." : undefined });
    router.refresh();
  }
  // Switches flip immediately; the server copy catches up, and a failure flips it back.
  const [ruleOverride, setRuleOverride] = useState<Record<string, boolean>>({});
  const ruleOn = (r: RuleItem) => ruleOverride[r.id] ?? r.enabled;
  async function toggleRule(r: RuleItem) {
    const next = !ruleOn(r);
    setRuleOverride((o) => ({ ...o, [r.id]: next }));
    const res = await fetch(`/api/operator/rules/${r.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: next }) }).catch(() => null);
    if (!res?.ok) {
      setRuleOverride((o) => ({ ...o, [r.id]: !next }));
      return toast({ tone: "danger", title: "That didn't save. Try again." });
    }
    const j = (await res.json().catch(() => ({}))) as { held?: number };
    toast({
      tone: "neutral",
      title: next ? `"${r.name}" is on` : `"${r.name}" is off for new content`,
      body: next ? (j.held ? `It found ${j.held} item${j.held > 1 ? "s" : ""} in your documents, now held for review.` : "Existing documents were checked; nothing new matched.") : undefined,
    });
    router.refresh();
  }
  const rulesOn = rules.filter(ruleOn).length;

  const tabsRef = useRef<HTMLDivElement>(null);
  function open(t: (typeof TABS)[number]) {
    setTab(t);
    const list = tabsRef.current;
    if (!list) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    list.scrollIntoView({ behavior, block: "start" });
    // On phones the tab row scrolls sideways: bring the chosen tab into view too.
    const chip = list.querySelector<HTMLElement>(`[data-tab="${t}"]`);
    if (chip) list.scrollTo({ left: chip.offsetLeft - list.offsetLeft - 16, behavior });
  }

  const counts = { review: visibleHeld.length, documents: visibleDocs.length, rules: rulesOn, log: log.length };
  const labels = { review: "Held for review", documents: "Kept staff-only", rules: "Protected info rules", log: "Activity" };

  return (
    <>
      <section className="grid grid-cols-3 gap-3">
        <Summary icon={ShieldCheck} tint="bg-warning-tint text-warning-ink" value={visibleHeld.length + visibleDocs.length} label="Waiting for you" onClick={() => open(visibleHeld.length || !visibleDocs.length ? "review" : "documents")} />
        <Summary icon={EyeOff} tint="bg-success-tint text-success-ink" value={protectedCount} label="Details protected" onClick={() => open("log")} />
        <Summary icon={Lock} tint="bg-accent-tint text-accent" value={rulesOn} label="Rules on" onClick={() => open("rules")} />
      </section>

      <div ref={tabsRef} role="tablist" aria-label="Privacy Guard sections" className="scroll-mt-20 lg:scroll-mt-6 scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button key={t} data-tab={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-10 shrink-0 rounded-full px-3.5 text-label font-semibold ring-1 transition ${tab === t ? "bg-ink text-surface ring-ink" : "bg-surface text-muted ring-line-soft hover:text-ink"}`}>
            {labels[t]} <span className="tabular">{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === "review" ? (
        visibleHeld.length === 0 ? (
          <Empty title="Nothing waiting" body="New documents are checked as they sync. Anything sensitive shows up here before families can see it." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[14px] bg-ai-tint px-4 py-3 text-dense text-ai-ink">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" aria-hidden /> These are hidden from families until you decide.
              </span>
              <button type="button" disabled={!!busy} onClick={() => review(visibleHeld.map((h) => h.id), "redact")} className="min-h-9 shrink-0 rounded-full bg-surface px-3 text-label font-semibold text-ink ring-1 ring-line hover:bg-sunken">
                {busy === "bulk" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Redact all"}
              </button>
            </div>
            {visibleHeld.map((h) => (
              <article key={h.id} className="rise-in rounded-[16px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-5">
                <header className="flex flex-wrap items-center gap-2">
                  <BrandIcon kind={h.sourceKind} size={28} />
                  <SourceTitle title={h.documentTitle} url={h.documentUrl} kind={h.sourceKind} className="min-w-0 truncate text-dense font-semibold text-ink" />
                  <Pill tone={CAT_TONE[h.category] ?? "neutral"} className="ml-auto">{CATEGORY_LABEL[h.category as PrivacyCategory] ?? h.label}</Pill>
                </header>
                <p className="mt-3 rounded-[12px] bg-canvas p-3.5 text-dense leading-7 text-muted ring-1 ring-line-soft">
                  {h.before.length >= 140 ? "…" : ""}
                  {h.before.replace(/\s+/g, " ")}
                  <mark className="rounded-[4px] bg-warning-tint px-0.5 font-medium text-warning-ink underline decoration-dashed decoration-[1.5px] underline-offset-4">{h.match.replace(/\s+/g, " ")}</mark>
                  {h.after.replace(/\s+/g, " ")}
                  {h.after.length >= 140 ? "…" : ""}
                </p>
                <p className="mt-2.5 flex items-start gap-1.5 text-caption text-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-ink" aria-hidden />
                  <span>
                    {h.reason} <span>({h.detector === "ai" ? "found by AI review" : "found by pattern"})</span>
                  </span>
                </p>
                <div className="mt-3.5 grid grid-cols-3 gap-2">
                  <Action busy={busy === h.id} onClick={() => review([h.id], "redact")} primary>
                    Redact
                  </Action>
                  <Action busy={false} onClick={() => review([h.id], "staff_only")}>
                    Staff only
                  </Action>
                  <Action busy={false} onClick={() => review([h.id], "dismiss")}>
                    It&apos;s fine
                  </Action>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === "documents" ? (
        visibleDocs.length === 0 ? (
          <Empty title="All confirmed" body="When Privacy Guard keeps a whole document from families (a payroll export, an incident report), you confirm it here once." />
        ) : (
          <ul className="space-y-3">
            {visibleDocs.map((d) => (
              <li key={d.id} className="rounded-[16px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-5">
                <div className="flex items-start gap-3">
                  <BrandIcon kind={d.sourceKind} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-headline font-semibold text-ink">
                      <SourceTitle title={d.title} url={d.url} kind={d.sourceKind} />
                    </p>
                    <p className="mt-0.5 text-dense text-muted">{d.reason ?? "It looks like a records file, not family information."}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.categories.slice(0, 4).map((c) => (
                        <Pill key={c} tone={CAT_TONE[c] ?? "neutral"}>{CATEGORY_LABEL[c as PrivacyCategory] ?? c}</Pill>
                      ))}
                      <span className="text-caption text-muted">{d.count} details found</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Action busy={busy === d.id} onClick={() => decideDoc(d.id, "staff")} primary>
                    <Lock className="h-4 w-4" aria-hidden /> Keep staff-only
                  </Action>
                  <Action busy={false} onClick={() => decideDoc(d.id, "family")}>
                    <Users className="h-4 w-4" aria-hidden /> Let families search it
                  </Action>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "rules" ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-[16px] border-2 border-dashed border-line bg-surface/60 p-4 text-left transition hover:border-accent hover:bg-accent-tint-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-on-accent">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-headline font-semibold text-ink">Add a rule</span>
              <span className="block text-dense text-muted">Something specific to your school, like a project name or a staff matter.</span>
            </span>
          </button>
          <ul className="overflow-hidden rounded-[16px] bg-surface shadow-1 ring-1 ring-line-soft">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-line-soft p-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-dense font-semibold text-ink">
                    {r.name}
                    {r.preset ? <Pill tone="neutral" dot={false}>Built in</Pill> : <Pill tone="accent" dot={false}>Yours</Pill>}
                  </p>
                  <p className="mt-0.5 text-caption text-muted">{r.description}</p>
                  {r.basis ? <p className="mt-1 text-caption text-muted">Why: {r.basis}</p> : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ruleOn(r)}
                  aria-label={r.name}
                  onClick={() => toggleRule(r)}
                  className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${ruleOn(r) ? "bg-accent" : "bg-line-strong"}`}
                >
                  <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-1 transition-transform ${ruleOn(r) ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted">These rules shaped what Front Desk protects. The standards named are our design inputs; this prototype does not claim compliance with them.</p>
        </div>
      ) : null}

      {tab === "log" ? (
        log.length === 0 ? (
          <Empty title="No activity yet" body="Every decision you make here is recorded, with who made it and when." />
        ) : (
          <ol className="overflow-hidden rounded-[16px] bg-surface shadow-1 ring-1 ring-line-soft">
            {log.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0">
                <History className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 text-dense text-ink">
                  <span className="font-semibold">{l.actor}</span> · {ACTION_LABEL[l.action] ?? l.action}
                  {typeof l.detail.title === "string" ? <span className="text-muted"> · {l.detail.title}</span> : typeof l.detail.name === "string" ? <span className="text-muted"> · {l.detail.name}</span> : typeof l.detail.count === "number" ? <span className="text-muted"> · {l.detail.count} item{l.detail.count === 1 ? "" : "s"}</span> : null}
                </span>
                <span className="shrink-0 text-caption text-muted">{ago(l.at)}</span>
              </li>
            ))}
          </ol>
        )
      ) : null}

      <AddRuleSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function Summary({ icon: Icon, tint, value, label, onClick }: { icon: React.ComponentType<{ className?: string }>; tint: string; value: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-[16px] bg-surface p-3.5 text-left shadow-1 ring-1 ring-line-soft transition hover:ring-line-strong active:scale-[0.98] sm:p-4">
      <span className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-full ${tint}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="tabular mt-2.5 block text-[24px] font-bold leading-tight text-ink">{value}</span>
      <span className="block text-caption text-muted">{label}</span>
    </button>
  );
}

function Action({ children, onClick, busy, primary = false }: { children: React.ReactNode; onClick: () => void; busy: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-label font-semibold transition active:scale-[0.98] disabled:opacity-60 ${primary ? "bg-ink text-surface hover:opacity-90" : "bg-surface text-ink ring-1 ring-line hover:bg-sunken"}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
    </button>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] bg-surface p-10 text-center shadow-1 ring-1 ring-line-soft">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success-tint text-success-ink">
        <Check className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-headline font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-dense text-muted">{body}</p>
    </div>
  );
}

function AddRuleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PrivacyCategory>("custom");
  const [busy, setBusy] = useState(false);
  const kindLabel = useId();
  async function save() {
    setBusy(true);
    const res = await fetch("/api/operator/rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, category }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't add the rule." });
    toast({ tone: "success", title: "Rule added. Your redaction list is updated.", body: j.held ? `It found ${j.held} item${j.held > 1 ? "s" : ""} in existing documents, now held for review.` : "Nothing in your current documents matches. New content will be checked." });
    setName("");
    setDescription("");
    setCategory("custom");
    onClose();
    router.refresh();
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add a protected-info rule"
      description="Front Desk checks every document against it, including what's already connected."
      snapPoints={[0.92]}
      footer={
        <button type="button" disabled={busy || name.trim().length < 2 || description.trim().length < 2} onClick={save} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-dense font-semibold text-on-accent disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />} Add rule and scan
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-label font-semibold text-ink">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Expansion plans" className="mt-1.5 h-11 w-full rounded-[10px] bg-surface px-3.5 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
        </label>
        <label className="block">
          <span className="text-label font-semibold text-ink">What should we look for?</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={'Anything mentioning "Project Falcon" or "second campus"'} className="mt-1.5 w-full rounded-[12px] bg-surface p-3.5 text-body text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
          <span className="mt-1 block text-caption text-muted">Put exact words in quotes. With AI review on, the description itself also guides the check.</span>
        </label>
        <div>
          <span id={kindLabel} className="text-label font-semibold text-ink">
            Kind of information
          </span>
          <CategoryPicker value={category} onChange={setCategory} labelId={kindLabel} />
        </div>
        <p className="flex items-start gap-2 rounded-[12px] bg-sunken p-3 text-caption text-muted">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Turning a rule off later never releases anything it already held. That stays your call, item by item.
        </p>
      </div>
    </Sheet>
  );
}

/** A document title that opens the original (Notion page, Drive doc) in a new tab, when there is one. */
function SourceTitle({ title, url, kind, className = "" }: { title: string; url: string | null; kind: string; className?: string }) {
  if (!url || url.includes("/demo/")) return <span className={className}>{title}</span>;
  const where = brandName(kind) ?? "the original";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`Open in ${where}`} className={`inline-flex max-w-full items-center gap-1 underline decoration-line-strong decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent ${className}`}>
      <span className="truncate">{title}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">(opens in {where})</span>
    </a>
  );
}
