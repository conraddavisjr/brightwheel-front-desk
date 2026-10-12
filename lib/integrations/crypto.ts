import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/**
 * OAuth tokens are encrypted at rest (AES-256-GCM, key derived from
 * TOKEN_ENCRYPTION_KEY) and never leave the server. Rotating the key means
 * reconnecting sources, which is the safe failure.
 */
const key = () => createHash("sha256").update(config.tokenKey).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

export function decrypt(enc: string): string {
  const [v, iv, tag, body] = enc.split(".");
  if (v !== "v1") throw new Error("unknown token format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/** OAuth state: signed school + person + nonce, so a callback can't be replayed into another school. */
export function signState(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string | null, maxAgeMs = 15 * 60 * 1000): Record<string, string> | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", config.sessionSecret).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, string> & { t: number };
  if (Date.now() - Number(data.t) > maxAgeMs) return null;
  return data;
}
