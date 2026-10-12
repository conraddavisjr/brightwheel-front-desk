import "server-only";
import { getSession, type Session } from "@/lib/session";

/** Operator API guard: a director (or staff) session, or a 401/403 response to return. */
export async function requireStaff(): Promise<{ session: Session; error: null } | { session: null; error: Response }> {
  const session = await getSession();
  if (!session) return { session: null, error: Response.json({ error: "Sign in first." }, { status: 401 }) };
  if (session.role === "parent") return { session: null, error: Response.json({ error: "Directors only." }, { status: 403 }) };
  return { session, error: null };
}
