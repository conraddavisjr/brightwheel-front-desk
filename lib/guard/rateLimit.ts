import "server-only";
import { db } from "@/lib/db/client";

/**
 * Fixed-window counters in Postgres (one atomic upsert per check). If the
 * counter itself fails we let the request through: a database hiccup
 * should not lock every parent out, and the daily model cap still bounds cost.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const start = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  try {
    const { data, error } = await db().rpc("bump_rate_limit", { p_key: key, p_window: start.toISOString() });
    if (error) throw error;
    const count = Number(data);
    const retryAfter = Math.ceil((start.getTime() + windowSeconds * 1000 - now) / 1000);
    return { ok: count <= limit, retryAfter };
  } catch (err) {
    console.error("[rate-limit] counter failed, allowing request", err);
    return { ok: true, retryAfter: 0 };
  }
}
