import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { audit } from "@/lib/operator/manualSource";

const Body = z.object({ enabled: z.boolean() });

/** Turn a rule on or off. Turning one off never releases text already held; that stays a per-item decision. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/operator/rules/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { data: rule } = await db().from("privacy_rules").select("id,school_id,name").eq("id", id).single();
  if (!rule || rule.school_id !== auth.session.schoolId) return Response.json({ error: "Not found." }, { status: 404 });
  await db().from("privacy_rules").update({ enabled: parsed.data.enabled }).eq("id", id);
  await audit(auth.session.schoolId, auth.session.personId, parsed.data.enabled ? "privacy.rule.enable" : "privacy.rule.disable", { ruleId: id, name: rule.name });
  return Response.json({ ok: true });
}
