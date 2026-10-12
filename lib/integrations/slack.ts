import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { db } from "@/lib/db/client";

/**
 * Slack: each new knowledge gap is posted to the school's channel with an
 * "Answer" button. The button opens a modal; its submission comes back to
 * /api/slack/interact, which publishes the answer exactly like the Inbox
 * drawer does. Staff can close the loop without opening the dashboard.
 *
 * With no SLACK_BOT_TOKEN, nothing is sent and the Inbox works on its own.
 */

export const slackConfigured = () => Boolean(config.integrations.slack.botToken && config.integrations.slack.channelId);

async function slackApi(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${config.integrations.slack.botToken}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!json.ok) throw new Error(`slack ${method}: ${String(json.error)}`);
  return json;
}

export async function notifyGap(gapId: string): Promise<void> {
  if (!slackConfigured()) return;
  const { data: gap } = await db().from("gaps").select("id,question,ask_count,topic,kind,note,slack_ts,school_id,schools(name)").eq("id", gapId).single();
  if (!gap) return;
  // One message per gap; later asks update it instead of posting again.
  const school = (gap.schools as unknown as { name: string } | null)?.name ?? "Your school";
  const title = gap.kind === "conflict" ? ":warning: Two documents disagree" : ":speech_balloon: A family asked something we couldn't answer";
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `*${title}*\n>${gap.question}${gap.note ? `\n_${gap.note}_` : ""}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${school} · ${gap.topic} · asked ${gap.ask_count}×` }] },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Answer" }, action_id: "answer_gap", value: gap.id },
        { type: "button", text: { type: "plain_text", text: "Open in Front Desk" }, url: `${config.appUrl}/operator/inbox?gap=${gap.id}`, action_id: "open_gap" },
      ],
    },
  ];
  if (gap.slack_ts) {
    await slackApi("chat.update", { channel: config.integrations.slack.channelId, ts: gap.slack_ts, text: gap.question, blocks });
  } else {
    const out = await slackApi("chat.postMessage", { channel: config.integrations.slack.channelId, text: gap.question, blocks });
    await db().from("gaps").update({ slack_ts: out.ts }).eq("id", gap.id);
  }
}

export async function openAnswerModal(triggerId: string, gapId: string, question: string): Promise<void> {
  await slackApi("views.open", {
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "answer_gap_submit",
      private_metadata: gapId,
      title: { type: "plain_text", text: "Answer for families" },
      submit: { type: "plain_text", text: "Publish" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*Question*\n>${question}` } },
        {
          type: "input",
          block_id: "answer",
          label: { type: "plain_text", text: "Your answer" },
          element: { type: "plain_text_input", action_id: "value", multiline: true, placeholder: { type: "plain_text", text: "Write it the way you'd say it at the front desk." } },
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: "Publishing adds this to the school's knowledge, runs Privacy Guard on it, and notifies the families who asked." }],
        },
      ],
    },
  });
}

export async function markAnsweredInSlack(gapId: string, by: string): Promise<void> {
  if (!slackConfigured()) return;
  const { data: gap } = await db().from("gaps").select("question,answer,slack_ts").eq("id", gapId).single();
  if (!gap?.slack_ts) return;
  await slackApi("chat.update", {
    channel: config.integrations.slack.channelId,
    ts: gap.slack_ts,
    text: gap.question,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Answered* by ${by}\n>${gap.question}\n${gap.answer ?? ""}` } },
    ],
  });
}

/** Verify Slack's request signature (v0 HMAC over the raw body, 5-minute replay window). */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = config.integrations.slack.signingSecret;
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
