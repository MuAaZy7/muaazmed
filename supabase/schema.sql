-- MuaazMed GEMP1 EYE: optional Supabase backend.
-- Run this SQL in a NEW Supabase project, then configure backend-config.js.
-- No passwords or API secrets belong in this repository.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Student' check (char_length(nickname) between 2 and 32),
  leaderboard_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mock_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paper text not null check (paper in ('A','B')),
  correct integer not null check (correct between 0 and 120),
  total integer not null default 120 check (total=120),
  completed_at timestamptz not null default now()
);

create index if not exists mock_results_user_idx on public.mock_results(user_id,completed_at desc);
create index if not exists mock_results_score_idx on public.mock_results(correct desc,completed_at asc);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.mock_results enable row level security;

drop policy if exists "profile read self" on public.profiles;
create policy "profile read self" on public.profiles for select to authenticated using (id=(select auth.uid()));
drop policy if exists "profile insert self" on public.profiles;
create policy "profile insert self" on public.profiles for insert to authenticated with check (id=(select auth.uid()));
drop policy if exists "profile update self" on public.profiles;
create policy "profile update self" on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));

drop policy if exists "progress read self" on public.progress;
create policy "progress read self" on public.progress for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "progress insert self" on public.progress;
create policy "progress insert self" on public.progress for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "progress update self" on public.progress;
create policy "progress update self" on public.progress for update to authenticated using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists "mock read self" on public.mock_results;
create policy "mock read self" on public.mock_results for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "mock insert self" on public.mock_results;
create policy "mock insert self" on public.mock_results for insert to authenticated with check(user_id=(select auth.uid()) and total=120 and correct between 0 and 120);

revoke all on table public.profiles, public.progress, public.mock_results from anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.progress to authenticated;
grant select,insert on public.mock_results to authenticated;

-- Only a minimal opt-in nickname and score are visible to community members.
-- Important: Mock marks are submitted by the browser; this board is motivational,
-- not anti-cheat secure or valid for formal assessment.
create or replace function public.get_leaderboard()
returns table(nickname text,best_score integer,attempts integer)
language sql security definer
set search_path = ''
stable
as $func$
  select p.nickname, max(r.correct)::integer as best_score, count(*)::integer as attempts
  from public.profiles p
  join public.mock_results r on r.user_id = p.id
  where p.leaderboard_visible = true
  group by p.id,p.nickname
  order by max(r.correct) desc,count(*) desc,p.nickname asc
  limit 100;
$func$;
revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon,authenticated;

-- Server-only AI request quota; never grant this function to browser roles.
create schema if not exists private;
create table if not exists private.ai_limits (
 user_id uuid not null,
 window_at timestamptz not null,
 request_count integer not null default 0 check (request_count>=0),
 primary key (user_id,window_at)
);
revoke all on schema private from public, anon, authenticated;
revoke all on table private.ai_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.ai_limits to service_role;

create or replace function public.consume_ai_quota(p_user uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $func$
declare
  w timestamptz;
  amount integer;
begin
  -- A rolling-ish ten-minute UTC bucket; max 12 calls per user per bucket.
  w := date_trunc('hour',now()) + (floor(extract(minute from now())/10)::integer * interval '10 minutes');
  insert into private.ai_limits(user_id,window_at,request_count)
  values(p_user,w,1)
  on conflict(user_id,window_at)
  do update set request_count=private.ai_limits.request_count+1
  returning request_count into amount;
  return amount <= 12;
end;
$func$;
revoke all on function public.consume_ai_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;
commit;

-- To set up:
-- 1. Enable Supabase Email Auth and configure https://muaazmed.com as Site URL.
-- 2. Add https://muaazmed.com and https://www.muaazmed.com to redirect allow list if used.
-- 3. Put ONLY the Supabase project URL and publishable key in backend-config.js.
-- 4. Deploy the ask-ai Edge Function and set OPENAI_API_KEY in Supabase secrets.
-- 5. Keep Supabase secret/service_role keys server-side only.
