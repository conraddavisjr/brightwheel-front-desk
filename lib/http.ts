/** The caller's IP as Vercel reports it (first hop of x-forwarded-for), for rate limiting only. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
