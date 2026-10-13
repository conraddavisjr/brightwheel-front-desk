/** Verdicts on suggested questions ("does this lead to an answer?"), per school. Cleared when knowledge changes. */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { ok: boolean; at: number }>();

export function cachedVerdict(schoolId: string, key: string): boolean | undefined {
  const hit = cache.get(`${schoolId}:${key}`);
  return hit && Date.now() - hit.at < TTL_MS ? hit.ok : undefined;
}

export function rememberVerdict(schoolId: string, key: string, ok: boolean) {
  cache.set(`${schoolId}:${key}`, { ok, at: Date.now() });
}

export function forgetFollowUps(schoolId: string) {
  for (const key of cache.keys()) if (key.startsWith(`${schoolId}:`)) cache.delete(key);
}
