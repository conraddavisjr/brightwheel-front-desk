import { z } from "zod";
import { requireStaff } from "@/lib/operator/auth";
import { runAsk } from "@/lib/answer/pipeline";
import { clientIp } from "@/lib/http";
import type { AnswerCard } from "@/lib/schemas";

const Body = z.object({ question: z.string().trim().min(1).max(500) });

/** "Ask a test question": the real parent pipeline, nothing saved, so directors can check an edit. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask a question." }, { status: 400 });
  let card: AnswerCard | null = null;
  let error: string | null = null;
  for await (const ev of runAsk({ question: parsed.data.question, channel: "text", schoolId: auth.session.schoolId, parentId: null, ip: `preview:${clientIp(req)}`, persist: false })) {
    if (ev.type === "done") card = ev.card;
    if (ev.type === "error") error = ev.message;
  }
  return card ? Response.json({ card }) : Response.json({ error: error ?? "No answer." }, { status: 502 });
}
