import "server-only";
import { db, must } from "@/lib/db/client";

/** The school's "Front Desk answers" source: everything written in the dashboard lives here. */
export async function manualSource(schoolId: string): Promise<string> {
  const { data } = await db().from("sources").select("id").eq("school_id", schoolId).eq("kind", "manual").maybeSingle();
  if (data) return data.id;
  const row = must(
    await db().from("sources").insert({ school_id: schoolId, kind: "manual", name: "Front Desk answers", account_label: "Written in Front Desk", status: "connected", last_synced_at: new Date().toISOString() }).select("id").single(),
    "manual source",
  );
  return row.id;
}

export async function audit(schoolId: string, actorId: string, action: string, detail: Record<string, unknown>) {
  await db().from("audit_log").insert({ school_id: schoolId, actor_id: actorId, action, detail });
}
