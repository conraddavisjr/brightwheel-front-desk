import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * The server's database client (service role). Row level security is on with
 * no policies, so this is the only way in; every query in lib/db scopes by
 * the session's school_id. Never import this from a client component.
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    if (!config.supabase.serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Throw on a Supabase error or missing data, return the data otherwise. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new Error(`${what}: no data`);
  return res.data as NonNullable<T>;
}

/** Throw on a Supabase error for writes that return nothing. */
export function ok(res: { error: { message: string } | null }, what: string): void {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
}
