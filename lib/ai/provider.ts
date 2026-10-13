import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { embedMany } from "ai";
import { aiLive, config } from "@/lib/config";
import { db } from "@/lib/db/client";
import { EMBED_DIMS, stubEmbed } from "@/lib/ai/stubEmbed";

/**
 * Every model call goes through here: one place for the provider, the stub
 * switch, the daily call cap and usage metering.
 *
 * Cost posture: Gemini's free tier by default. The daily cap keeps a busy
 * demo day inside the free quota; past it, callers fall back to the free
 * paths (extractive answers, pattern-only Privacy Guard).
 */

let google: ReturnType<typeof createGoogle> | null = null;
export function gemini() {
  if (!google) google = createGoogle({ apiKey: config.ai.geminiKey });
  return google;
}

export type AiKind = "answer" | "classify" | "embed" | "tts" | "ocr";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Claim one live model call for today (key present, not stubbed, under the daily cap). The claim is
 * atomic in Postgres, so concurrent requests can't overshoot the cap. Call it right before the call.
 */
export async function canCallModel(): Promise<boolean> {
  if (!aiLive()) return false;
  const { data, error } = await db().rpc("reserve_ai_call", { p_day: today(), p_cap: config.ai.dailyCallCap });
  if (error) {
    console.error("[ai] could not reserve a call; using the free path", error);
    return false;
  }
  return data === true;
}

/** A read-only look at whether live calls are still available today (claims nothing). */
export async function modelAvailable(): Promise<boolean> {
  if (!aiLive()) return false;
  const { data } = await db().from("ai_usage").select("calls").eq("day", today()).eq("kind", "reserved").maybeSingle();
  return (data?.calls ?? 0) < config.ai.dailyCallCap;
}

export async function meter(kind: AiKind, inputTokens = 0, outputTokens = 0): Promise<void> {
  await db().rpc("bump_ai_usage", { p_day: today(), p_kind: kind, p_in: inputTokens, p_out: outputTokens });
}

export interface Embedded {
  vectors: number[][];
  /** "stub" or the model id; stored on each chunk so queries compare like with like. */
  model: string;
}

/**
 * Embed passages ("document") or a question ("query"). Falls back to the stub
 * embedder. Pass `model` to match an existing index (a query against a stub
 * index must be stub-embedded too).
 */
export async function embedTexts(values: string[], task: "document" | "query", model?: string): Promise<Embedded> {
  if (values.length === 0) return { vectors: [], model: model ?? "stub" };
  const wantLive = model ? model !== "stub" : true;
  if (wantLive && (await canCallModel())) {
    try {
      const out: number[][] = [];
      // The API takes up to 100 values per request.
      for (let i = 0; i < values.length; i += 100) {
        const batch = values.slice(i, i + 100);
        const { embeddings, usage } = await embedMany({
          model: gemini().embeddingModel(config.ai.embeddingModel),
          values: batch,
          providerOptions: {
            google: { outputDimensionality: EMBED_DIMS, taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" },
          },
        });
        await meter("embed", usage?.tokens ?? 0, 0);
        out.push(...embeddings.map(normalize));
      }
      return { vectors: out, model: config.ai.embeddingModel };
    } catch (err) {
      console.error("[ai] embedding failed, using stub embedder", err);
    }
  }
  if (model && model !== "stub") throw new Error(`index was embedded with ${model}, which is unavailable right now`);
  return { vectors: values.map(stubEmbed), model: "stub" };
}

/** gemini-embedding-001 at reduced dimensions is not unit length; cosine needs it to be. */
function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** pgvector's text form. */
export const toPgVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
