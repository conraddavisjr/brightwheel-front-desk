import { db } from "@/lib/db/client";
import { ingestDocument } from "@/lib/ingest/ingest";
import { manualSource, audit } from "@/lib/operator/manualSource";
import { markAnsweredInSlack, openAnswerModal, verifySlackSignature } from "@/lib/integrations/slack";

/**
 * Slack interactivity: the "Answer" button opens a modal; submitting it
 * publishes the answer exactly like the Inbox does (same ingest, same
 * Privacy Guard). Every request is verified with Slack's signing secret.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySlackSignature(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return new Response("bad signature", { status: 401 });
  }
  const payload = JSON.parse(new URLSearchParams(raw).get("payload") ?? "{}") as {
    type: string;
    trigger_id?: string;
    user?: { name?: string; username?: string };
    actions?: Array<{ action_id: string; value?: string }>;
    view?: { callback_id: string; private_metadata: string; state: { values: Record<string, Record<string, { value?: string }>> } };
  };

  if (payload.type === "block_actions" && payload.actions?.[0]?.action_id === "answer_gap" && payload.trigger_id) {
    const gapId = payload.actions[0].value ?? "";
    const { data: gap } = await db().from("gaps").select("question").eq("id", gapId).single();
    if (gap) await openAnswerModal(payload.trigger_id, gapId, gap.question);
    return new Response(null, { status: 200 });
  }

  if (payload.type === "view_submission" && payload.view?.callback_id === "answer_gap_submit") {
    const gapId = payload.view.private_metadata;
    const answer = payload.view.state.values.answer?.value?.value?.trim() ?? "";
    if (answer.length < 2) return Response.json({ response_action: "errors", errors: { answer: "Write an answer first." } });
    const { data: gap } = await db().from("gaps").select("id,school_id,question").eq("id", gapId).single();
    if (!gap) return new Response(null, { status: 200 });
    const { data: director } = await db().from("people").select("id").eq("school_id", gap.school_id).eq("role", "director").limit(1).single();
    const sourceId = await manualSource(gap.school_id);
    const title = gap.question.replace(/[?.!]+$/, "");
    const r = await ingestDocument({ schoolId: gap.school_id, sourceId, externalId: `gap:${gap.id}`, title, content: `# ${title}\n\n${answer}`, emoji: "💬", parentTitle: "Front Desk answers", visibility: "family", authoredBy: director?.id ?? null });
    const now = new Date().toISOString();
    await db().from("gaps").update({ status: "answered", answer, answer_document_id: r.documentId, answered_by: director?.id ?? null, answered_at: now, notified_at: now }).eq("id", gap.id);
    if (director) await audit(gap.school_id, director.id, "gap.answer", { gapId: gap.id, via: "slack", by: payload.user?.name ?? payload.user?.username });
    await markAnsweredInSlack(gap.id, payload.user?.name ?? "staff");
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 200 });
}
