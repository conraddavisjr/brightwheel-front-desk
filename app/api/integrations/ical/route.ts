import { z } from "zod";
import { db, must } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { syncSource } from "@/lib/integrations/sync";
import { audit } from "@/lib/operator/manualSource";

const Body = z.object({ url: z.string().url().max(800).refine((u) => /^https:\/\//.test(u.replace(/^webcal:/, "https:")), "Use an https or webcal link.") });

/** Connect a public calendar by its iCal link (Google, Outlook, Apple all publish one). */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const raw = (await req.json().catch(() => null)) as { url?: string } | null;
  const parsed = Body.safeParse({ url: raw?.url?.trim().replace(/^webcal:\/\//, "https://") });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "That doesn't look like a calendar link." }, { status: 400 });
  const host = new URL(parsed.data.url).hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(host)) return Response.json({ error: "That link isn't reachable from the internet." }, { status: 400 });
  const source = must(await db().from("sources").insert({ school_id: auth.session.schoolId, kind: "ical", name: "Calendar link", account_label: host, status: "connected", config: { url: parsed.data.url } }).select("id").single(), "source");
  try {
    const r = await syncSource(source.id);
    await audit(auth.session.schoolId, auth.session.personId, "source.connect", { kind: "ical", name: host, events: r.events });
    return Response.json({ ok: true, events: r.events });
  } catch {
    await db().from("sources").delete().eq("id", source.id);
    return Response.json({ error: "We couldn't read that calendar. Check that the link is public." }, { status: 400 });
  }
}
