/**
 * The key demo sessions are signed with. One source for both the app and proxy.ts, so the proxy
 * verifies exactly what the app signs (a local setup without SESSION_SECRET uses the dev default).
 */
export const DEV_SESSION_SECRET = "local-dev-session-secret-change-me-0123456789";

export function sessionSecret(): string {
  return process.env.SESSION_SECRET || DEV_SESSION_SECRET;
}
