import { z } from "zod";
import { db } from "@/lib/db/client";
import { createSession } from "@/lib/session";

/**
 * One-tap demo sign-in: pick a school and a perspective. A real product
 * would use brightwheel's own auth; the session that results is the same
 * shape either way, and every read is scoped by it.
 */
const Body = z.object({ school: z.enum(["sunflower-valley", "harbor-kids"]), role: z.enum(["director", "parent"]), personId: z.string().uuid().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a school and a role." }, { status: 400 });
  const { data: school } = await db().from("schools").select("id").eq("slug", parsed.data.school).single();
  if (!school) return Response.json({ error: "Demo data is missing. Run npm run seed." }, { status: 503 });
  let q = db().from("people").select("id,role").eq("school_id", school.id).eq("role", parsed.data.role);
  if (parsed.data.personId) q = q.eq("id", parsed.data.personId);
  const { data: person } = await q.order("created_at").limit(1).maybeSingle();
  if (!person) return Response.json({ error: "No such demo person." }, { status: 404 });
  await createSession({ personId: person.id, schoolId: school.id, role: person.role });
  return Response.json({ ok: true, redirect: parsed.data.role === "director" ? "/operator" : "/ask" });
}
