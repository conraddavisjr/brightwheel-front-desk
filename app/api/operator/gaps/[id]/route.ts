import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { ingestDocument, reindexDocument } from "@/lib/ingest/ingest";
import { audit, manualSource } from "@/lib/operator/manualSource";
import { plain } from "@/lib/text";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), title: z.string().trim().min(2).max(120), answer: z.string().trim().min(2).max(4000), notify: z.boolean().default(true) }),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("archive_document"), documentId: z.string().uuid() }),
]);

/**
 * Close a knowledge gap. "answer" writes a family-visible page through the
 * same ingest pipeline as every other source (so Privacy Guard checks the
 * director's own words too) and makes it searchable immediately.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/operator/gaps/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the form and try again." }, { status: 400 });
  const client = db();
  const { data: gap } = await client.from("gaps").select("id,school_id,question,asker_ids,kind").eq("id", id).single();
  if (!gap || gap.school_id !== session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
  const body = parsed.data;
  const now = new Date().toISOString();

  if (body.action === "dismiss" || body.action === "reopen") {
    await client.from("gaps").update({ status: body.action === "dismiss" ? "dismissed" : "open" }).eq("id", id);
    await audit(session.schoolId, session.personId, `gap.${body.action}`, { gapId: id });
    return Response.json({ ok: true });
  }

  if (body.action === "archive_document") {
    const { data: doc } = await client.from("documents").select("id,school_id,title").eq("id", body.documentId).single();
    if (!doc || doc.school_id !== session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
    await client.from("documents").update({ status: "archived", updated_at: now }).eq("id", doc.id);
    await reindexDocument(doc.id);
    await client.from("gaps").update({ status: "answered", answered_by: session.personId, answered_at: now, answer: `Archived "${doc.title}" so only the current version is used.` }).eq("id", id);
    await audit(session.schoolId, session.personId, "document.archive", { documentId: doc.id, title: doc.title, gapId: id });
    return Response.json({ ok: true });
  }

  const sourceId = await manualSource(session.schoolId);
  const result = await ingestDocument({
    schoolId: session.schoolId,
    sourceId,
    externalId: `gap:${id}`,
    title: body.title,
    content: `# ${body.title}\n\n${body.answer}`,
    emoji: "💬",
    parentTitle: "Front Desk answers",
    authoredBy: session.personId,
    visibility: "family",
  });
  await client
    .from("gaps")
    .update({ status: "answered", answer: body.answer, answer_document_id: result.documentId, answered_by: session.personId, answered_at: now, notified_at: body.notify ? now : null })
    .eq("id", id);
  await audit(session.schoolId, session.personId, "gap.answer", { gapId: id, documentId: result.documentId, notified: body.notify ? gap.asker_ids.length : 0 });
  return Response.json({ ok: true, documentId: result.documentId, held: result.newlyHeld, notified: body.notify ? gap.asker_ids.length : 0 });
}

/** What the search found closest to this question, so the director can see why it fell short. */
export async function GET(_req: Request, ctx: RouteContext<"/api/operator/gaps/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const { data: gap } = await db().from("gaps").select("id,school_id,question").eq("id", id).single();
  if (!gap || gap.school_id !== auth.session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
  const { searchKnowledge } = await import("@/lib/retrieval/search");
  const r = await searchKnowledge(gap.school_id, gap.question, 3);
  return Response.json({
    strength: r.strength,
    related: r.passages.map((p) => ({ documentId: p.documentId, title: p.title, heading: p.heading.split(" > ").slice(1).join(" › "), excerpt: plain(p.text).slice(0, 220) })),
  });
}
