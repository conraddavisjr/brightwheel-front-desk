import { z } from "zod";
import { requireStaff } from "@/lib/operator/auth";
import { reviewFindings } from "@/lib/privacy/review";
import { audit } from "@/lib/operator/manualSource";

const Body = z.object({ action: z.enum(["redact", "staff_only", "dismiss"]), ids: z.array(z.string().uuid()).max(500).optional() });

/** Review one finding (or several, when the id is "bulk" and ids are passed). */
export async function POST(req: Request, ctx: RouteContext<"/api/operator/findings/[id]">) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick an action." }, { status: 400 });
  const ids = id === "bulk" ? (parsed.data.ids ?? []) : [id];
  const n = await reviewFindings(auth.session.schoolId, auth.session.personId, ids, parsed.data.action);
  if (n === 0) return Response.json({ error: "Not found." }, { status: 404 });
  await audit(auth.session.schoolId, auth.session.personId, `privacy.${parsed.data.action}`, { count: n, ids });
  return Response.json({ ok: true, count: n });
}
