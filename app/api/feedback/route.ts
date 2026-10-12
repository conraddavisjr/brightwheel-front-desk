import { z } from "zod";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/session";

const Body = z.object({ messageId: z.string().uuid(), value: z.union([z.literal(1), z.literal(-1)]), note: z.string().max(500).optional() });

/** Thumbs up/down on one answer. Only the parent who asked can rate it. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad feedback." }, { status: 400 });
  const { data: msg } = await db().from("messages").select("id,school_id,conversations(parent_id)").eq("id", parsed.data.messageId).single();
  const owner = (msg?.conversations as unknown as { parent_id: string } | null)?.parent_id;
  if (!msg || msg.school_id !== session.schoolId || owner !== session.personId) return Response.json({ error: "Not found." }, { status: 404 });
  await db().from("messages").update({ feedback: parsed.data.value, feedback_note: parsed.data.note ?? null }).eq("id", msg.id);
  return Response.json({ ok: true });
}
