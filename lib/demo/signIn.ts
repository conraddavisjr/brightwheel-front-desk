import { db } from "@/lib/db/client";
import { createSession } from "@/lib/session";

export type DemoSchool = "sunflower-valley" | "harbor-kids";
export type DemoRole = "director" | "parent";

/**
 * One-tap demo sign-in: pick a school and a perspective. A real product would
 * use brightwheel's own auth; the session that results is the same shape
 * either way, and every read is scoped by it.
 */
export async function startDemoSession(slug: DemoSchool, role: DemoRole, personId?: string): Promise<{ redirect: string } | { error: string; status: number }> {
  const { data: school } = await db().from("schools").select("id").eq("slug", slug).single();
  if (!school) return { error: "Demo data is missing. Run npm run seed.", status: 503 };
  let q = db().from("people").select("id,role").eq("school_id", school.id).eq("role", role);
  if (personId) q = q.eq("id", personId);
  const { data: person } = await q.order("created_at").limit(1).maybeSingle();
  if (!person) return { error: "No such demo person.", status: 404 };
  await createSession({ personId: person.id, schoolId: school.id, role: person.role });
  return { redirect: role === "director" ? "/operator" : "/ask" };
}
