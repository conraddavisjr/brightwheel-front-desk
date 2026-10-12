import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { syncSource } from "@/lib/integrations/sync";
import { audit } from "@/lib/operator/manualSource";

const Body = z.object({ sourceId: z.string().uuid(), fileIds: z.array(z.string().min(5).max(200)).min(1).max(50) });

/** Add Picker-chosen files to a Drive source and sync them. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick at least one file." }, { status: 400 });
  const { data: src } = await db().from("sources").select("id,school_id,kind,config").eq("id", parsed.data.sourceId).single();
  if (!src || src.school_id !== auth.session.schoolId || src.kind !== "drive") return Response.json({ error: "Not found." }, { status: 404 });
  const fileIds = [...new Set([...(((src.config as { fileIds?: string[] }).fileIds) ?? []), ...parsed.data.fileIds])];
  await db().from("sources").update({ config: { ...(src.config as object), fileIds } }).eq("id", src.id);
  const r = await syncSource(src.id);
  await audit(auth.session.schoolId, auth.session.personId, "source.sync", { kind: "drive", files: parsed.data.fileIds.length, held: r.held });
  return Response.json({ ok: true, ...r });
}
