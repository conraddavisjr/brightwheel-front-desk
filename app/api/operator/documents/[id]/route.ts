import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { ingestDocument, reindexDocument } from "@/lib/ingest/ingest";
import { audit } from "@/lib/operator/manualSource";

async function load(id: string, schoolId: string) {
  const { data } = await db().from("documents").select("id,school_id,source_id,external_id,title,emoji,parent_title,url,mime,content,visibility,visibility_reason,visibility_set_by,status,source_updated_at,updated_at,sources(kind,account_label)").eq("id", id).single();
  return data && data.school_id === schoolId ? data : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/operator/documents/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const doc = await load(id, auth.session.schoolId);
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });
  const { data: findings } = await db().from("findings").select("id,category,label,excerpt,status,reason,detector,span_start,span_end").eq("document_id", id).order("span_start");
  const { count } = await db().from("chunks").select("id", { count: "exact", head: true }).eq("document_id", id);
  return Response.json({ document: doc, findings: findings ?? [], chunks: count ?? 0 });
}

const Patch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  content: z.string().max(200_000).optional(),
  visibility: z.enum(["family", "staff"]).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

/**
 * Edit the source of truth. Content edits go back through ingest, so Privacy
 * Guard re-checks the director's own words; a visibility change re-indexes
 * immediately (staff-only removes it from parent search at once).
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/operator/documents/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await ctx.params;
  const doc = await load(id, session.schoolId);
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the fields and try again." }, { status: 400 });
  const p = parsed.data;
  const client = db();

  if (p.content !== undefined || p.title !== undefined) {
    const r = await ingestDocument(
      {
        schoolId: session.schoolId,
        sourceId: doc.source_id,
        externalId: doc.external_id,
        title: p.title ?? doc.title,
        content: p.content ?? doc.content,
        emoji: doc.emoji,
        parentTitle: doc.parent_title,
        url: doc.url,
        mime: doc.mime,
        sourceUpdatedAt: new Date().toISOString(),
        authoredBy: session.personId,
        visibility: p.visibility ?? (doc.visibility_set_by === "director" ? doc.visibility : undefined),
      },
      { force: true },
    );
    await audit(session.schoolId, session.personId, "document.edit", { documentId: id, title: p.title ?? doc.title });
    return Response.json({ ok: true, held: r.newlyHeld, visibility: r.visibility, chunks: r.chunks });
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.visibility) Object.assign(update, { visibility: p.visibility, visibility_set_by: "director", visibility_reviewed: true, visibility_reason: null });
  if (p.status) update.status = p.status;
  await client.from("documents").update(update).eq("id", id);
  // Findings follow the document: in a staff-only document they need no separate review.
  if (p.visibility === "staff") await client.from("findings").update({ status: "staff_only" }).eq("document_id", id).eq("status", "held");
  const chunks = await reindexDocument(id);
  await audit(session.schoolId, session.personId, p.visibility ? "document.visibility" : "document.status", { documentId: id, ...p });
  return Response.json({ ok: true, chunks });
}
