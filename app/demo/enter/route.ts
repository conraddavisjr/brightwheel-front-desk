import { z } from "zod";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/session";
import { startDemoSession } from "@/lib/demo/signIn";

/**
 * GET /demo/enter?school=harbor-kids&role=parent[&next=/ask]: step into the demo as that
 * person, then land on `next` (or their home). A plain link and a redirect, so it works
 * without JavaScript and never depends on a page from an older deploy. Without a school,
 * it keeps the visitor's current school (switching sides), else Harbor Kids.
 * A real product would use brightwheel's own sign-in here.
 */
const Query = z.object({
  school: z.enum(["sunflower-valley", "harbor-kids"]).optional(),
  role: z.enum(["director", "parent"]),
  // Only our own app pages: never an open redirect.
  next: z.string().regex(/^\/(operator|ask)(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.redirect(new URL("/", url), 303);
  let school = parsed.data.school;
  if (!school) {
    const current = await getSession();
    const { data } = current ? await db().from("schools").select("slug").eq("id", current.schoolId).maybeSingle() : { data: null };
    school = data?.slug === "sunflower-valley" ? "sunflower-valley" : "harbor-kids";
  }
  const result = await startDemoSession(school, parsed.data.role);
  if ("error" in result) return new Response(result.error, { status: result.status });
  const next = parsed.data.next && parsed.data.next.startsWith(parsed.data.role === "director" ? "/operator" : "/ask") ? parsed.data.next : result.redirect;
  return new Response(null, { status: 303, headers: { location: next, "cache-control": "no-store" } });
}
