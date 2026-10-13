import { z } from "zod";
import { startDemoSession } from "@/lib/demo/signIn";

/** JSON twin of the signInAs Server Action, for tests and scripts. */
const Body = z.object({ school: z.enum(["sunflower-valley", "harbor-kids"]), role: z.enum(["director", "parent"]), personId: z.string().uuid().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a school and a role." }, { status: 400 });
  const result = await startDemoSession(parsed.data.school, parsed.data.role, parsed.data.personId);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, redirect: result.redirect });
}
