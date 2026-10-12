import { z } from "zod";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/session";
import { hit } from "@/lib/guard/rateLimit";

const Body = z.object({ text: z.string().trim().min(1).max(1500), conversationId: z.string().uuid().nullable().optional(), toParentId: z.string().uuid().optional() });

/**
 * A human message. From a parent, it lands in the director's Conversations
 * as "needs a reply". From a director, it is a reply to that parent.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a message first." }, { status: 400 });
  const rl = await hit(`msg:${session.personId}`, 20, 600);
  if (!rl.ok) return Response.json({ error: "Too many messages. Try again in a few minutes." }, { status: 429 });
  const client = db();

  let conversationId = parsed.data.conversationId ?? null;
  const parentId = session.role === "parent" ? session.personId : parsed.data.toParentId;
  if (!parentId) return Response.json({ error: "Who is this for?" }, { status: 400 });
  if (conversationId) {
    const { data } = await client.from("conversations").select("id,school_id,parent_id").eq("id", conversationId).maybeSingle();
    if (!data || data.school_id !== session.schoolId || data.parent_id !== parentId) conversationId = null;
  }
  if (!conversationId) {
    const { data: who } = await client.from("people").select("id").eq("id", parentId).eq("school_id", session.schoolId).maybeSingle();
    if (!who) return Response.json({ error: "Not found." }, { status: 404 });
    const { data } = await client.from("conversations").insert({ school_id: session.schoolId, parent_id: parentId, channel: "text" }).select("id").single();
    conversationId = data!.id;
  }
  await client.from("messages").insert({
    conversation_id: conversationId,
    school_id: session.schoolId,
    role: session.role === "parent" ? "parent" : "staff",
    text: parsed.data.text,
    reason: session.role === "parent" ? "to_staff" : "staff_reply",
    author_id: session.personId,
  });
  await client.from("conversations").update({ last_at: new Date().toISOString() }).eq("id", conversationId);
  return Response.json({ ok: true, conversationId });
}
