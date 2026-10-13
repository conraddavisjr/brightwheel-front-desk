-- A hard daily cap on model calls: each call claims a slot atomically before it runs.
-- The upsert only increments while under the cap (the row lock serializes concurrent requests),
-- so a busy moment cannot overshoot the way check-then-call can.
create or replace function reserve_ai_call(p_day date, p_cap int)
returns boolean
language sql
as $$
  with claimed as (
    insert into ai_usage(day, kind, calls, input_tokens, output_tokens) values (p_day, 'reserved', 1, 0, 0)
    on conflict (day, kind) do update set calls = ai_usage.calls + 1 where ai_usage.calls < p_cap
    returning calls
  )
  select exists (select 1 from claimed) and 1 <= p_cap;
$$;

revoke execute on function reserve_ai_call(date, int) from anon, authenticated, public;
grant execute on function reserve_ai_call(date, int) to service_role;
