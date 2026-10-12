import { AskRequestSchema } from "@/lib/schemas";
import { getSession } from "@/lib/session";
import { runAsk } from "@/lib/answer/pipeline";
import { clientIp } from "@/lib/http";

/**
 * POST /api/ask: newline-delimited JSON events (see AskEvent in lib/schemas).
 * The school always comes from the signed session, never from the body.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = AskRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask a question." }, { status: 400 });

  const encoder = new TextEncoder();
  const events = runAsk({
    question: parsed.data.question,
    conversationId: parsed.data.conversationId ?? null,
    channel: parsed.data.channel,
    schoolId: session.schoolId,
    parentId: session.role === "parent" ? session.personId : null,
    ip: clientIp(req),
  });

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (err) {
        console.error("[api/ask] failed", err);
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: "Something went wrong on our side. Please try again.", retryable: true })}\n`));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
