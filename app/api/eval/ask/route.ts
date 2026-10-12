import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { db } from "@/lib/db/client";
import { runAsk } from "@/lib/answer/pipeline";
import type { AnswerCard } from "@/lib/schemas";

/**
 * The eval route for the in-house harness (../ai-eval-cafe). 404 unless
 * EVAL_ENABLED=true, and fails closed without a matching EVAL_SECRET.
 * Runs the exact parent pipeline with nothing saved, and reports outcome,
 * reason, the card and per-phase timings.
 */
const Body = z.object({ case_id: z.string().max(100), question: z.string().min(1).max(2000), school: z.enum(["sunflower-valley", "harbor-kids"]) });

function authorized(req: Request): boolean {
  if (!config.eval.secret) return false;
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(config.eval.secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: Request) {
  if (!config.eval.enabled) return new Response("Not found", { status: 404 });
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { data: school } = await db().from("schools").select("id").eq("slug", parsed.data.school).single();
  if (!school) return Response.json({ error: "seed the demo schools first" }, { status: 503 });

  const t0 = Date.now();
  let mark = t0;
  const steps: Array<{ name: string; ms: number }> = [];
  let card: AnswerCard | null = null;
  let reason: string | null = null;
  let error: string | null = null;
  const phaseName: Record<string, string> = { checking: "guard", searching: "retrieve", reading: "retrieve", writing: "generate" };
  let phase = "guard";
  for await (const ev of runAsk({ question: parsed.data.question, channel: "text", schoolId: school.id, parentId: null, ip: `eval:${parsed.data.case_id}`, persist: false })) {
    if (ev.type === "status") {
      const next = phaseName[ev.phase] ?? ev.phase;
      if (next !== phase) {
        steps.push({ name: phase, ms: Date.now() - mark });
        mark = Date.now();
        phase = next;
      }
    }
    if (ev.type === "done") card = ev.card;
    if (ev.type === "error") error = ev.message;
  }
  steps.push({ name: phase, ms: Date.now() - mark });
  if (!card) return Response.json({ outcome: "error", reason: "pipeline_error", detail: error, steps, latencyMs: Date.now() - t0 });
  reason = card.outcome;
  const text = [card.headline, card.body, ...card.facts.map((f) => `${f.label}: ${f.value}`), ...card.steps.map((s) => `${s.title} ${s.detail}`), ...card.events.map((e) => `${e.title} ${e.startsAt}`)].join("\n");
  return Response.json({
    outcome: card.outcome,
    reason,
    detail: card.headline,
    output: { ...card, text, sources: card.citations.map((c) => c.title) },
    steps,
    latencyMs: Date.now() - t0,
  });
}
