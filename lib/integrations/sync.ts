import "server-only";
import { db, must } from "@/lib/db/client";
import { ingestDocument, schoolPrivacyContext, reindexDocument } from "@/lib/ingest/ingest";
import { decrypt } from "@/lib/integrations/crypto";
import { blocksToMarkdown, listSharedPages, notionClient } from "@/lib/integrations/notion";
import { googleAccessToken, listCalendarEvents, readDriveFile, type CalEventIn } from "@/lib/integrations/google";
import { parseIcal } from "@/lib/integrations/ical";
import { screenEvent } from "@/lib/privacy/events";

/**
 * Pull one source and push everything through ingest. Incremental: a page
 * whose text did not change is skipped by its content hash (no embedding,
 * no AI review), and a page that disappeared from the source is archived,
 * which removes it from family search.
 */

export interface SyncResult {
  documents: number;
  changed: number;
  archived: number;
  events: number;
  held: number;
}

interface SourceRow {
  id: string;
  school_id: string;
  kind: string;
  token_enc: string | null;
  config: { demo?: boolean; fileIds?: string[]; calendarId?: string; url?: string; rootPageIds?: string[] };
}

export async function syncSource(sourceId: string): Promise<SyncResult> {
  const client = db();
  const src = must(await client.from("sources").select("id,school_id,kind,token_enc,config").eq("id", sourceId).single(), "source") as SourceRow;
  await client.from("sources").update({ status: "syncing", last_error: null }).eq("id", sourceId);
  try {
    const result = await run(src);
    await client.from("sources").update({ status: "connected", last_synced_at: new Date().toISOString() }).eq("id", sourceId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] failed", sourceId, message);
    await client.from("sources").update({ status: "error", last_error: message.slice(0, 300) }).eq("id", sourceId);
    throw err;
  }
}

async function run(src: SourceRow): Promise<SyncResult> {
  const token = src.token_enc ? decrypt(src.token_enc) : null;
  if (!token && src.kind !== "ical" && src.kind !== "manual" && src.kind !== "upload") {
    // Seeded demo source without a live connection: re-check what is already here.
    return demoRefresh(src);
  }
  const ctx = await schoolPrivacyContext(src.school_id);
  const school = must(await db().from("schools").select("timezone").eq("id", src.school_id).single(), "school");
  const seen: string[] = [];
  let changed = 0;
  let held = 0;

  if (src.kind === "notion") {
    const notion = notionClient(token!);
    const pages = await listSharedPages(notion);
    const titleById = new Map(pages.map((p) => [p.id, p.title]));
    for (const p of pages) {
      const body = await blocksToMarkdown(notion, p.id);
      const r = await ingestDocument({ schoolId: src.school_id, sourceId: src.id, externalId: p.id, title: p.title, content: `# ${p.title}\n\n${body}`, emoji: p.emoji, parentTitle: p.parentId ? (titleById.get(p.parentId) ?? null) : null, url: p.url, sourceUpdatedAt: p.lastEdited }, { ctx });
      seen.push(p.id);
      if (r.changed) changed++;
      held += r.newlyHeld;
    }
  } else if (src.kind === "drive") {
    const access = await googleAccessToken(token!);
    for (const id of src.config.fileIds ?? []) {
      const f = await readDriveFile(access, id).catch((e) => {
        console.error("[drive] skipped", id, e);
        return null;
      });
      if (!f) continue;
      const r = await ingestDocument({ schoolId: src.school_id, sourceId: src.id, externalId: f.id, title: f.title, content: f.markdown, emoji: f.mime.includes("spreadsheet") || f.mime === "text/csv" ? "📊" : f.mime === "application/pdf" ? "📕" : "📄", url: f.url, mime: f.mime, sourceUpdatedAt: f.modified }, { ctx });
      seen.push(f.id);
      if (r.changed) changed++;
      held += r.newlyHeld;
    }
  } else if (src.kind === "calendar" || src.kind === "ical") {
    let events: CalEventIn[];
    if (src.kind === "calendar") {
      events = await listCalendarEvents(await googleAccessToken(token!), src.config.calendarId ?? "primary", school.timezone);
    } else {
      const res = await fetch(src.config.url!, { headers: { accept: "text/calendar" } });
      if (!res.ok) throw new Error(`calendar link returned ${res.status}`);
      events = parseIcal(await res.text(), school.timezone);
    }
    return upsertEvents(src, events);
  } else {
    return demoRefresh(src);
  }

  // Anything the source no longer has is archived (and so leaves family search).
  const { data: existing } = await db().from("documents").select("id,external_id,status").eq("source_id", src.id);
  let archived = 0;
  for (const d of existing ?? []) {
    if (d.external_id && !seen.includes(d.external_id) && d.status === "active") {
      await db().from("documents").update({ status: "archived" }).eq("id", d.id);
      await reindexDocument(d.id);
      archived++;
    }
  }
  return { documents: seen.length, changed, archived, events: 0, held };
}

async function upsertEvents(src: SourceRow, events: CalEventIn[]): Promise<SyncResult> {
  let held = 0;
  const ctx = await schoolPrivacyContext(src.school_id);
  const rows = events.map((raw) => {
    // Privacy Guard checks events too: codes or names in a description never reach families.
    const e = screenEvent(raw, ctx);
    held += e.held;
    return {
      school_id: src.school_id,
      source_id: src.id,
      external_id: e.id,
      title: e.title,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      all_day: e.allDay,
      location: e.location,
      description: e.description,
      // Private calendar entries (staff meetings, reviews) and sensitive titles never reach families.
      visibility: e.private || e.staffOnly || /^staff[:\s]/i.test(e.title) ? "staff" : "family",
    };
  });
  await db().from("events").delete().eq("source_id", src.id);
  if (rows.length) must(await db().from("events").insert(rows).select("id"), "events");
  return { documents: 0, changed: rows.length, archived: 0, events: rows.length, held };
}

async function demoRefresh(src: SourceRow): Promise<SyncResult> {
  const { data: docs } = await db().from("documents").select("id").eq("source_id", src.id).eq("status", "active");
  const { count } = await db().from("events").select("id", { count: "exact", head: true }).eq("source_id", src.id);
  return { documents: docs?.length ?? 0, changed: 0, archived: 0, events: count ?? 0, held: 0 };
}
