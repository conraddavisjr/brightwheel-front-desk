import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";

/**
 * Demo sessions: a signed, HttpOnly cookie naming one person at one school.
 * The one-tap demo sign-in issues it; every server read derives the school
 * from it, never from the request body, so one school can never ask about
 * another's data.
 */

export interface Session {
  personId: string;
  schoolId: string;
  role: "director" | "staff" | "parent";
}

const COOKIE = "fd_session";
const key = () => new TextEncoder().encode(config.sessionSecret);

export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.personId !== "string" || typeof payload.schoolId !== "string") return null;
    return { personId: payload.personId, schoolId: payload.schoolId, role: payload.role as Session["role"] };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
