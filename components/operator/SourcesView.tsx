"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Plus, Upload, Link2, CheckCircle2, AlertTriangle, Trash2, FilePlus2, Info } from "lucide-react";
import { BrandIcon } from "@/components/operator/BrandIcon";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ago } from "@/components/operator/IntegrationTiles";

export interface SourceCard {
  id: string;
  kind: string;
  name: string;
  status: string;
  account: string | null;
  lastSynced: string | null;
  error: string | null;
  live: boolean;
  demo: boolean;
  docs: number;
  familyDocs: number;
  events: number;
}

const FLASH: Record<string, string> = {
  notion_not_configured: "Notion isn't set up on this deployment yet (it needs a Notion OAuth app). The demo schools show seeded Notion content.",
  google_not_configured: "Google isn't set up on this deployment yet (it needs a Google OAuth client).",
  notion_denied: "Notion access was cancelled. Nothing was connected.",
  google_denied: "Google access was cancelled. Nothing was connected.",
  notion_failed: "We couldn't finish connecting Notion. Try again.",
  drive_failed: "We couldn't finish connecting Google Drive. Try again.",
  calendar_failed: "We couldn't finish connecting Google Calendar. If this app is in testing mode, your Google account must be on its test-user list.",
  state: "That connection link expired. Start again.",
};

const SECTIONS = [
  { kind: "notion", title: "Notion", body: "Share your handbook pages with Front Desk in Notion's own permission screen. Only pages you pick are read.", connect: "/api/integrations/notion/start", needs: "notion" as const },
  { kind: "drive", title: "Google Drive", body: "Pick the Docs, Sheets, PDFs or images Front Desk may read. It can't see anything else in your Drive.", connect: "/api/integrations/google/start?product=drive", needs: "google" as const },
  { kind: "calendar", title: "Calendar", body: "Events, closures and holidays become event cards families can add to their own calendar. Private events stay private.", connect: "/api/integrations/google/start?product=calendar", needs: "google" as const },
];

export function SourcesView({ sources, flash, configured }: { sources: SourceCard[]; flash: Record<string, string | undefined>; configured: { notion: boolean; google: boolean; slack: boolean } }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [icalOpen, setIcalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SourceCard | null>(null);

  useEffect(() => {
    if (flash.connected) {
      const what = flash.connected === "notion" ? "Notion" : flash.connected === "drive" ? "Google Drive" : "Google Calendar";
      toast({ tone: "success", title: `${what} connected`, body: flash.docs ? `${flash.docs} pages synced${flash.held && flash.held !== "0" ? `, ${flash.held} details held by Privacy Guard` : ""}.` : flash.events ? `${flash.events} events synced.` : undefined });
    }
    if (flash.pick) void openPicker(flash.pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync(s: SourceCard) {
    setBusy(s.id);
    const res = await fetch(`/api/integrations/${s.id}/sync`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Sync failed." });
    toast({
      tone: "success",
      title: s.demo ? "Up to date" : "Synced",
      body: s.demo ? "This demo source is seeded. Connect your own to sync live." : j.events ? `${j.events} events` : `${j.documents} pages · ${j.changed} changed${j.held ? ` · ${j.held} held for review` : ""}`,
    });
    router.refresh();
  }

  async function disconnect(s: SourceCard) {
    setBusy(s.id);
    await fetch(`/api/integrations/${s.id}/sync`, { method: "DELETE" });
    setBusy(null);
    setConfirmDelete(null);
    toast({ tone: "neutral", title: `${s.name} disconnected`, body: "Its pages and events are no longer used." });
    router.refresh();
  }

  async function openPicker(sourceId: string) {
    const res = await fetch(`/api/integrations/google/picker-token?source=${sourceId}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't open Google Drive." });
    await loadScript("https://apis.google.com/js/api.js");
    const gapi = (window as unknown as { gapi: { load: (n: string, cb: () => void) => void } }).gapi;
    await new Promise<void>((r) => gapi.load("picker", () => r()));
    const g = (window as unknown as { google: { picker: Record<string, any> } }).google.picker; // eslint-disable-line @typescript-eslint/no-explicit-any
    const view = new g.DocsView(g.ViewId.DOCS).setMimeTypes("application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet,application/pdf,text/plain,text/markdown,text/csv,image/png,image/jpeg").setIncludeFolders(true).setSelectFolderEnabled(false);
    const picker = new g.PickerBuilder()
      .addView(view)
      .enableFeature(g.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(j.accessToken)
      .setDeveloperKey(j.apiKey)
      .setAppId(j.appId)
      .setTitle("Pick files for Front Desk")
      .setCallback(async (data: { action: string; docs?: Array<{ id: string }> }) => {
        if (data.action !== g.Action.PICKED || !data.docs?.length) return;
        setBusy(sourceId);
        const r = await fetch("/api/integrations/drive/files", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId, fileIds: data.docs.map((d) => d.id) }) });
        const out = await r.json().catch(() => ({}));
        setBusy(null);
        if (!r.ok) return toast({ tone: "danger", title: out.error ?? "Couldn't add those files." });
        toast({ tone: "success", title: `Added ${data.docs.length} file${data.docs.length > 1 ? "s" : ""}`, body: out.held ? `Privacy Guard held ${out.held} detail${out.held > 1 ? "s" : ""} for review.` : "Families can ask about them now." });
        router.replace("/operator/sources");
        router.refresh();
      })
      .build();
    picker.setVisible(true);
  }

  const err = flash.error ? FLASH[flash.error] ?? "Something went wrong connecting that source." : null;

  return (
    <>
      {err ? (
        <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-warning-tint p-3.5 text-dense text-warning-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {err}
        </p>
      ) : null}

      {SECTIONS.map((sec) => {
        const mine = sources.filter((s) => s.kind === sec.kind || (sec.kind === "calendar" && s.kind === "ical"));
        const can = configured[sec.needs];
        return (
          <section key={sec.kind} id={sec.kind} className="scroll-mt-6 rounded-[20px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <BrandIcon kind={sec.kind} size={48} />
              <div className="min-w-[60%] flex-1">
                <h2 className="text-title-2 font-bold text-ink">{sec.title}</h2>
                <p className="mt-0.5 max-w-xl text-dense text-muted">{sec.body}</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                {sec.kind === "calendar" ? (
                  <button type="button" onClick={() => setIcalOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-dense font-semibold text-ink ring-1 ring-line hover:bg-sunken">
                    <Link2 className="h-4 w-4" aria-hidden /> Use a calendar link
                  </button>
                ) : null}
                <a
                  href={can ? sec.connect : undefined}
                  aria-disabled={!can}
                  onClick={(e) => {
                    if (!can) {
                      e.preventDefault();
                      toast({ tone: "neutral", title: `${sec.title} OAuth isn't configured on this deployment`, body: "See docs/SETUP.md. The demo schools show seeded content in the meantime." });
                    }
                  }}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-dense font-semibold ${can ? "bg-accent text-on-accent shadow-1 hover:bg-accent-hover" : "bg-sunken text-muted"}`}
                >
                  <Plus className="h-4 w-4" aria-hidden /> {mine.length ? `Connect another` : `Connect ${sec.title === "Calendar" ? "Google Calendar" : sec.title}`}
                </a>
              </div>
            </div>
            {mine.length ? (
              <ul className="mt-5 space-y-2.5">
                {mine.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-canvas-operator p-3.5 ring-1 ring-line-soft">
                    <div className="min-w-[55%] flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-dense font-semibold text-ink">
                        {s.account ?? s.name}
                        {s.status === "error" ? <Pill tone="danger">Needs attention</Pill> : s.status === "syncing" ? <Pill tone="info">Syncing</Pill> : <Pill tone="success">Connected</Pill>}
                        {s.demo ? <Pill tone="neutral" dot={false}>Demo data</Pill> : null}
                      </p>
                      <p className="mt-0.5 text-caption text-muted">
                        {s.kind === "calendar" || s.kind === "ical" ? `${s.events} events` : `${s.docs} pages · ${s.familyDocs} family-visible`} · synced {ago(s.lastSynced)}
                      </p>
                      {s.error ? <p className="mt-1 text-caption text-danger-ink">{s.error}</p> : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.kind === "drive" && s.live ? (
                        <button type="button" onClick={() => openPicker(s.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-tint px-3 text-label font-semibold text-accent">
                          <FilePlus2 className="h-4 w-4" aria-hidden /> Add files
                        </button>
                      ) : null}
                      <button type="button" onClick={() => sync(s)} disabled={busy === s.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-label font-semibold text-ink ring-1 ring-line hover:bg-sunken disabled:opacity-60">
                        {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Sync now
                      </button>
                      <button type="button" aria-label={`Disconnect ${s.account ?? s.name}`} onClick={() => setConfirmDelete(s)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-danger-tint hover:text-danger-ink">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      <section id="slack" className="scroll-mt-6 rounded-[20px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <BrandIcon kind="slack" size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-title-2 font-bold text-ink">
              Slack {configured.slack ? <Pill tone="success">Connected</Pill> : <Pill tone="neutral" dot={false}>Not connected</Pill>}
            </h2>
            <p className="mt-0.5 max-w-xl text-dense text-muted">When a family asks something Front Desk can&apos;t answer, it posts to your staff channel with an Answer button. Answer in Slack and it&apos;s published here, the same as the Inbox.</p>
            {!configured.slack ? <p className="mt-2 flex items-start gap-1.5 text-caption text-muted"><Info className="mt-0.5 h-3.5 w-3.5" aria-hidden /> Set up with the app manifest in docs/slack-manifest.json.</p> : null}
          </div>
        </div>
      </section>

      <UploadZone onDone={() => router.refresh()} />

      <IcalSheet open={icalOpen} onClose={() => setIcalOpen(false)} />
      <Sheet
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Disconnect ${confirmDelete?.account ?? confirmDelete?.name ?? ""}?`}
        description="Front Desk stops using its pages and events right away. Your originals are not touched."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-12 rounded-full bg-surface text-dense font-semibold text-ink ring-1 ring-line">
              Keep it
            </button>
            <button type="button" disabled={!!busy} onClick={() => confirmDelete && disconnect(confirmDelete)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger text-dense font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Disconnect
            </button>
          </div>
        }
      >
        <p className="text-dense text-muted">{confirmDelete ? `${confirmDelete.docs || confirmDelete.events} ${confirmDelete.events ? "events" : "pages"} will be removed from Front Desk. Answers that cited them will stop doing so.` : null}</p>
      </Sheet>
    </>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(s);
  });
}

function IcalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const res = await fetch("/api/integrations/ical", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ tone: "danger", title: j.error ?? "Couldn't read that calendar." });
    toast({ tone: "success", title: `Calendar connected · ${j.events} events` });
    setUrl("");
    onClose();
    router.refresh();
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Connect a calendar link"
      description="Paste the public iCal address of your school calendar. In Google Calendar: Settings > your calendar > Public address in iCal format."
      snapPoints={[0.7]}
      footer={
        <button type="button" disabled={busy || !url.trim()} onClick={add} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-dense font-semibold text-on-accent disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />} Connect calendar
        </button>
      }
    >
      <label htmlFor="ical-url" className="text-label font-semibold text-ink">
        Calendar link
      </label>
      <input id="ical-url" value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className="mt-1.5 h-12 w-full rounded-[12px] bg-surface px-3.5 text-dense text-ink ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-accent" />
    </Sheet>
  );
}

function UploadZone({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 5)) {
      setBusy(file.name);
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/operator/upload", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) toast({ tone: "danger", title: `${file.name}: ${j.error ?? "upload failed"}` });
      else
        toast({
          tone: j.visibility === "staff" || j.held ? "neutral" : "success",
          title: j.visibility === "staff" ? `${file.name} kept staff-only` : `${file.name} added`,
          body: j.visibility === "staff" ? `Privacy Guard found ${j.findings} sensitive details, so families can't search it. Review it in Privacy Guard.` : j.held ? `${j.held} detail${j.held > 1 ? "s" : ""} held for review. The rest is searchable now.` : `${j.chunks} passages searchable now.`,
        });
    }
    setBusy(null);
    onDone();
  }
  return (
    <section id="upload" aria-label="Upload a file" className="scroll-mt-6">
      <h2 className="text-headline font-semibold text-ink">Or upload a file</h2>
      <p className="text-dense text-muted">For anything not in Notion or Drive: a PDF handbook, a photo of a flyer, a text file. Up to 4 MB.</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files);
        }}
        className={`mt-3 flex flex-col items-center justify-center rounded-[20px] border-2 border-dashed p-8 text-center transition ${drag ? "border-accent bg-accent-tint" : "border-line bg-surface"}`}
      >
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden /> : <Upload className="h-8 w-8 text-accent" aria-hidden />}
        <p className="mt-3 text-dense font-semibold text-ink">{busy ? `Checking ${busy}…` : "Drop files here"}</p>
        <p className="text-caption text-muted">PDF, PNG, JPG, TXT, MD or CSV</p>
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-dense font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Choose files
        </button>
        <input ref={input} aria-label="Upload files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv,application/pdf,image/*,text/*" className="sr-only" onChange={(e) => upload(e.target.files)} />
      </div>
    </section>
  );
}
