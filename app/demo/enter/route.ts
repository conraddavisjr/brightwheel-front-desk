import { z } from "zod";
import { startDemoSession } from "@/lib/demo/signIn";

/**
 * GET /demo/enter?school=harbor-kids&role=parent: step into the demo as that
 * person, then land on their home. A plain link and a redirect, so it works
 * without JavaScript and never depends on a page from an older deploy.
 * A real product would use brightwheel's own sign-in here.
 */
const Query = z.object({ school: z.enum(["sunflower-valley", "harbor-kids"]), role: z.enum(["director", "parent"]) });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.redirect(new URL("/", url), 303);
  const result = await startDemoSession(parsed.data.school, parsed.data.role);
  if ("error" in result) return new Response(result.error, { status: result.status });
  return new Response(null, { status: 303, headers: { location: result.redirect, "cache-control": "no-store" } });
}
