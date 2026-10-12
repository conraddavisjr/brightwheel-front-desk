import { describe, expect, it } from "vitest";
import { decrypt, encrypt, signState, verifyState } from "./crypto";

describe("token encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const enc = encrypt("secret_abc123");
    expect(enc).not.toContain("secret_abc123");
    expect(decrypt(enc)).toBe("secret_abc123");
  });
  it("rejects tampering", () => {
    const enc = encrypt("x");
    const bad = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(bad)).toThrow();
  });
});

describe("oauth state", () => {
  it("verifies its own signature and rejects edits", () => {
    const s = signState({ schoolId: "a", personId: "b" });
    expect(verifyState(s)?.schoolId).toBe("a");
    const [body, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ schoolId: "other", personId: "b", t: Date.now() })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
    expect(verifyState(`${body}.x${sig}`)).toBeNull();
  });
});
