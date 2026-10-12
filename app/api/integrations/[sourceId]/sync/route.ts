import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { syncSource } from "@/lib/integrations/sync";
import { audit } from "@/lib/operator/manualSource";
import { hit } from "@/lib/guard/rateLimit";

export async function POST(_req: Request, ctx: RouteContext<"/api/integrations/[sourceId]/sync">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { sourceId } = await ctx.params;
  const { data: src } = await db().from("sources").select("id,school_id,kind").eq("id", sourceId).single();
  if (!src || src.school_id !== auth.session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
  const rl = await hit(`sync:${sourceId}`, 6, 600);
  if (!rl.ok) return Response.json({ error: "Synced a lot just now. Try again in a few minutes." }, { status: 429 });
  try {
    const r = await syncSource(sourceId);
    await audit(auth.session.schoolId, auth.session.personId, "source.sync", { kind: src.kind, ...r });
    return Response.json({ ok: true, ...r });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed." }, { status: 502 });
  }
}

/** Disconnect: removes the source and everything it brought in (documents, passages, events). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/integrations/[sourceId]/sync">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { sourceId } = await ctx.params;
  const { data: src } = await db().from("sources").select("id,school_id,kind,name").eq("id", sourceId).single();
  if (!src || src.school_id !== auth.session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
  await db().from("sources").delete().eq("id", sourceId);
  await audit(auth.session.schoolId, auth.session.personId, "source.disconnect", { kind: src.kind, name: src.name });
  return Response.json({ ok: true });
}
