-- Defense in depth: the public API roles cannot call our functions at all.
-- (Row level security already makes them read nothing; this removes the surface.)
revoke execute on function search_chunks(uuid, text, vector, text, int, int, int) from anon, authenticated, public;
revoke execute on function search_events(uuid, text, timestamptz, int) from anon, authenticated, public;
revoke execute on function bump_rate_limit(text, timestamptz) from anon, authenticated, public;
revoke execute on function bump_ai_usage(date, text, bigint, bigint) from anon, authenticated, public;
revoke execute on function record_gap(uuid, text, text, text, uuid, text, text) from anon, authenticated, public;
grant execute on function search_chunks(uuid, text, vector, text, int, int, int), search_events(uuid, text, timestamptz, int), bump_rate_limit(text, timestamptz), bump_ai_usage(date, text, bigint, bigint), record_gap(uuid, text, text, text, uuid, text, text) to service_role;
