-- brightwheel Front Desk: initial schema.
--
-- Tenancy: every row carries school_id. Row level security is on for every
-- table with no policies, so the anon and authenticated keys can read nothing.
-- Only the server (service role) touches data, and every query in lib/db is
-- scoped by the school of the signed-in session. See docs/ARCHITECTURE.md.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- Schools -------------------------------------------------------------------

create table schools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short_name text not null,
  tagline text,
  city text,
  timezone text not null default 'America/Los_Angeles',
  phone text,
  email text,
  address text,
  ages text,
  -- Weekly hours, e.g. {"mon":["07:00","18:00"], ...}. Null day = closed.
  hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  role text not null check (role in ('director', 'staff', 'parent')),
  name text not null,
  email text,
  avatar_hue int not null default 230,
  -- Parents: [{"name":"Leo","room":"Sprouts"}]
  children jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index people_school on people(school_id, role);

-- Sources and documents -------------------------------------------------------

create table sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  kind text not null check (kind in ('notion', 'drive', 'calendar', 'ical', 'upload', 'manual', 'slack')),
  name text not null,
  status text not null default 'connected' check (status in ('connected', 'syncing', 'error', 'disconnected')),
  account_label text,
  -- Encrypted OAuth tokens (lib/integrations/crypto.ts). Never sent to the browser.
  token_enc text,
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index sources_school on sources(school_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  external_id text,
  title text not null,
  emoji text,
  parent_title text,
  url text,
  mime text not null default 'text/markdown',
  -- Normalized text as ingested (Markdown). Staff-only; parents only ever see chunks.
  content text not null default '',
  content_hash text not null default '',
  visibility text not null default 'family' check (visibility in ('family', 'staff')),
  -- Why it has this visibility, and who decided ('auto' until a director changes it).
  visibility_reason text,
  visibility_set_by text not null default 'auto' check (visibility_set_by in ('auto', 'director')),
  -- Hash of the text the AI classifier last saw, so re-syncs of unchanged text cost nothing.
  classified_hash text,
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Set when the director wrote it here (Knowledge editor or a gap answer).
  authored_by uuid references people(id),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index documents_school on documents(school_id, status);

-- Privacy Guard ---------------------------------------------------------------

create table privacy_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  category text not null,
  name text not null,
  description text not null,
  -- Optional regex the deterministic detector also runs.
  pattern text,
  preset boolean not null default false,
  enabled boolean not null default true,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);
create index privacy_rules_school on privacy_rules(school_id);

create table findings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  rule_id uuid references privacy_rules(id) on delete set null,
  category text not null,
  label text not null,
  -- Character offsets into documents.content, and the matched text.
  span_start int not null,
  span_end int not null,
  excerpt text not null,
  detector text not null check (detector in ('pattern', 'ai')),
  confidence real not null default 1,
  reason text,
  status text not null default 'held' check (status in ('held', 'redacted', 'staff_only', 'dismissed')),
  resolved_by uuid references people(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, span_start, span_end, category)
);
create index findings_school_status on findings(school_id, status);

-- Retrieval -------------------------------------------------------------------

create table chunks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  ord int not null,
  heading text not null default '',
  text text not null,
  -- Only family-visible, redacted text is ever written here.
  visibility text not null default 'family' check (visibility in ('family', 'staff')),
  embedding vector(768),
  -- Which embedder made the vector ('stub' or a model id). Queries only compare like with like.
  embed_model text not null default 'stub',
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(text, '')), 'B')
  ) stored,
  created_at timestamptz not null default now()
);
create index chunks_school on chunks(school_id, visibility);
create index chunks_fts on chunks using gin(fts);
create index chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);

create table events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  external_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  description text,
  visibility text not null default 'family' check (visibility in ('family', 'staff')),
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(location, '')), 'B')
  ) stored,
  unique (source_id, external_id)
);
create index events_school_time on events(school_id, starts_at);
create index events_fts on events using gin(fts);

-- Conversations, feedback and gaps ---------------------------------------------

create table conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  parent_id uuid references people(id) on delete set null,
  channel text not null default 'text' check (channel in ('text', 'voice', 'guided')),
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index conversations_school on conversations(school_id, last_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  role text not null check (role in ('parent', 'assistant', 'staff')),
  text text not null,
  card jsonb,
  outcome text check (outcome in ('answered', 'unsure', 'declined', 'handoff', 'care')),
  reason text,
  topic text,
  citations jsonb not null default '[]'::jsonb,
  latency_ms int,
  feedback smallint check (feedback in (-1, 1)),
  feedback_note text,
  author_id uuid references people(id),
  created_at timestamptz not null default now()
);
create index messages_conversation on messages(conversation_id, created_at);
create index messages_school_time on messages(school_id, created_at desc);

create table gaps (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  question text not null,
  normalized text not null,
  topic text not null default 'general',
  -- 'question': parents asked and we had no answer. 'conflict': two sources disagree.
  kind text not null default 'question' check (kind in ('question', 'conflict')),
  note text,
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  ask_count int not null default 1,
  asker_ids uuid[] not null default '{}',
  first_asked_at timestamptz not null default now(),
  last_asked_at timestamptz not null default now(),
  answer text,
  answer_document_id uuid references documents(id) on delete set null,
  answer_link text,
  answered_by uuid references people(id),
  answered_at timestamptz,
  notified_at timestamptz,
  slack_ts text,
  unique (school_id, normalized)
);
create index gaps_school_status on gaps(school_id, status, last_asked_at desc);

-- Operations ------------------------------------------------------------------

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table ai_usage (
  day date not null,
  kind text not null,
  calls int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (day, kind)
);

create table audit_log (
  id bigserial primary key,
  school_id uuid references schools(id) on delete cascade,
  actor_id uuid references people(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index audit_school on audit_log(school_id, at desc);

-- Lock everything down: no policies means only the service role reads or writes.
alter table schools enable row level security;
alter table people enable row level security;
alter table sources enable row level security;
alter table documents enable row level security;
alter table privacy_rules enable row level security;
alter table findings enable row level security;
alter table chunks enable row level security;
alter table events enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table gaps enable row level security;
alter table rate_limits enable row level security;
alter table ai_usage enable row level security;
alter table audit_log enable row level security;

-- Hybrid search: dense (cosine, HNSW) + sparse (full text) fused with
-- reciprocal rank fusion. Family-visible chunks of one school only.
create or replace function search_chunks(
  p_school uuid,
  p_query text,
  p_embedding vector(768),
  p_embed_model text default 'stub',
  p_limit int default 8,
  p_pool int default 20,
  p_rrf_k int default 60
)
returns table (
  chunk_id uuid,
  document_id uuid,
  heading text,
  text text,
  rrf real,
  vec_rank int,
  fts_rank int,
  distance real,
  lexical real
)
language sql stable
set search_path = public, extensions
as $$
  with q as (
    select websearch_to_tsquery('english', p_query) as tsq,
           -- An OR of the query's words, so a question still matches a passage
           -- that has only some of its words.
           nullif(array_to_string(
             array(select distinct quote_literal(lexeme) from unnest(to_tsvector('english', p_query))), ' | '
           ), '')::text as orq
  ),
  dense as (
    select c.id, c.embedding <=> p_embedding as distance,
           row_number() over (order by c.embedding <=> p_embedding) as rnk
    from chunks c
    where c.school_id = p_school and c.visibility = 'family' and c.embedding is not null
      and c.embed_model = p_embed_model and p_embedding is not null
    order by c.embedding <=> p_embedding
    limit p_pool
  ),
  sparse as (
    select c.id,
           ts_rank_cd(c.fts, coalesce(to_tsquery('english', q.orq), q.tsq), 32) as score,
           row_number() over (order by ts_rank_cd(c.fts, coalesce(to_tsquery('english', q.orq), q.tsq), 32) desc) as rnk
    from chunks c, q
    where c.school_id = p_school and c.visibility = 'family'
      and c.fts @@ coalesce(to_tsquery('english', q.orq), q.tsq)
    order by score desc
    limit p_pool
  ),
  fused as (
    select coalesce(d.id, s.id) as id,
           coalesce(1.0 / (p_rrf_k + d.rnk), 0) + coalesce(1.0 / (p_rrf_k + s.rnk), 0) as rrf,
           d.rnk as vec_rank, s.rnk as fts_rank, d.distance, s.score
    from dense d full outer join sparse s on d.id = s.id
  )
  select c.id, c.document_id, c.heading, c.text, f.rrf::real, f.vec_rank::int, f.fts_rank::int,
         f.distance::real, f.score::real
  from fused f join chunks c on c.id = f.id
  order by f.rrf desc
  limit p_limit;
$$;

-- Atomic fixed-window counter for rate limiting. Returns the count after increment.
create or replace function bump_rate_limit(p_key text, p_window timestamptz)
returns int
language sql
as $$
  insert into rate_limits(key, window_start, count) values (p_key, p_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count;
$$;

create or replace function bump_ai_usage(p_day date, p_kind text, p_in bigint, p_out bigint)
returns int
language sql
as $$
  insert into ai_usage(day, kind, calls, input_tokens, output_tokens) values (p_day, p_kind, 1, p_in, p_out)
  on conflict (day, kind) do update set calls = ai_usage.calls + 1,
    input_tokens = ai_usage.input_tokens + p_in, output_tokens = ai_usage.output_tokens + p_out
  returning calls;
$$;

-- Upsert a gap, counting each asker once.
create or replace function record_gap(p_school uuid, p_question text, p_normalized text, p_topic text, p_asker uuid,
  p_kind text default 'question', p_note text default null)
returns uuid
language plpgsql
as $$
declare gid uuid;
begin
  insert into gaps(school_id, question, normalized, topic, asker_ids, kind, note)
  values (p_school, p_question, p_normalized, p_topic, case when p_asker is null then '{}' else array[p_asker] end, p_kind, p_note)
  on conflict (school_id, normalized) do update set
    ask_count = gaps.ask_count + 1,
    last_asked_at = now(),
    status = case when gaps.status = 'dismissed' then 'dismissed' else 'open' end,
    asker_ids = case when p_asker is null or p_asker = any(gaps.asker_ids) then gaps.asker_ids
                     else gaps.asker_ids || p_asker end
  returning id into gid;
  return gid;
end;
$$;

-- Calendar search: full-text match on title/description, upcoming first.
-- With no text match, callers fall back to the next few upcoming events.
create or replace function search_events(p_school uuid, p_query text, p_from timestamptz, p_limit int default 5)
returns setof events
language sql stable
as $$
  with q as (
    select nullif(array_to_string(
      array(select distinct quote_literal(lexeme) from unnest(to_tsvector('english', p_query))), ' | '
    ), '') as orq
  )
  select e.* from events e, q
  where e.school_id = p_school and e.visibility = 'family'
    and coalesce(e.ends_at, e.starts_at) >= p_from
    and q.orq is not null and e.fts @@ to_tsquery('english', q.orq)
  order by ts_rank_cd(e.fts, to_tsquery('english', q.orq)) desc, e.starts_at asc
  limit p_limit;
$$;
