import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sessionSecret } from "@/lib/sessionSecret";

/**
 * The demo has no sign-in step: opening /operator (or any page under it) steps you in as the
 * director, and /ask as the parent, landing on the page you asked for. A visitor who already
 * has the right demo identity passes straight through.
 */
const ROLE_FOR = [
  { prefix: "/operator", role: "director" },
  { prefix: "/ask", role: "parent" },
] as const;

async function sessionRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("fd_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(sessionSecret()));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const need = ROLE_FOR.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!need) return NextResponse.next();
  const role = await sessionRole(req);
  // Staff count as the director side.
  if (role === need.role || (need.role === "director" && role === "staff")) return NextResponse.next();
  const enter = new URL("/demo/enter", req.url);
  enter.searchParams.set("role", need.role);
  enter.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(enter, 307);
}

export const config = {
  matcher: ["/operator/:path*", "/ask/:path*"],
};
