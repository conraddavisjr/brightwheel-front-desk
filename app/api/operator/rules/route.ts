import { z } from "zod";
import { db, must } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { applyRule } from "@/lib/privacy/review";
import { audit } from "@/lib/operator/manualSource";
import { PRIVACY_CATEGORIES } from "@/lib/schemas";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(400),
  category: z.enum(PRIVACY_CATEGORIES).default("custom"),
  pattern: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((p) => {
      if (!p) return true;
      try {
        new RegExp(p);
        return true;
      } catch {
        return false;
      }
    }, "That pattern isn't valid."),
});

/** Add a protected-info rule and apply it to everything already ingested. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the rule." }, { status: 400 });
  const { session } = auth;
  const p = parsed.data;
  if (!p.pattern && !/["“][^"”]{2,}["”]/.test(p.description)) {
    return Response.json({ error: 'Put the words to look for in quotes, like "Project Falcon", or add an exact pattern.' }, { status: 400 });
  }
  const rule = must(
    await db().from("privacy_rules").insert({ school_id: session.schoolId, name: p.name, description: p.description, category: p.category, pattern: p.pattern || null, preset: false, enabled: true, created_by: session.personId }).select("id,name,description,pattern,category").single(),
    "rule",
  );
  const held = await applyRule(session.schoolId, rule);
  await audit(session.schoolId, session.personId, "privacy.rule.add", { ruleId: rule.id, name: p.name, held });
  return Response.json({ ok: true, held });
}
