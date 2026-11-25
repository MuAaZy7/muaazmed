-- MuaazMed initial installation. Run once in the project's SQL Editor.
-- Includes the base schema and invitation membership migration in order.

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


-- Run AFTER supabase/schema.sql, in SQL Editor as postgres.
-- Verified email accounts may redeem invitations, but membership is server-enforced.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.memberships(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'student' check(role in ('student','admin')),
 active boolean not null default true,
 joined_at timestamptz not null default now()
);
create table if not exists private.invites(
 id uuid primary key default gen_random_uuid(),
 code_hash text not null unique,
 label text not null default '',
 max_uses int not null check(max_uses between 1 and 100),
 uses int not null default 0 check(uses>=0 and uses<=max_uses),
 expires_at timestamptz not null,
 revoked boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists private.redeem_limits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_at timestamptz not null,
 attempts int not null default 0
);
revoke all on all tables in schema private from public,anon,authenticated;

create or replace function public.member_status()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',coalesce(m.active,false),'admin',coalesce(m.active and m.role='admin',false))
 from (select auth.uid() as uid) u left join private.memberships m on m.user_id=u.uid;
$$;
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memberships m where m.user_id=auth.uid() and m.active);
$$;
create or replace function public.redeem_invite(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); inv private.invites%rowtype; n int; bucket timestamptz:=date_trunc('hour',now()); existing private.memberships%rowtype;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
  return jsonb_build_object('ok',false,'error','Confirm your email and sign in first.');
 end if;
 -- Serialize redemptions for one account, including concurrently presented codes.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into existing from private.memberships where user_id=uid;
 if found then
  if existing.active then return jsonb_build_object('ok',true); end if;
  return jsonb_build_object('ok',false,'error','Your membership is suspended. Contact the administrator.');
 end if;
 insert into private.redeem_limits(user_id,window_at,attempts) values(uid,bucket,1)
 on conflict(user_id) do update set attempts=case when private.redeem_limits.window_at=excluded.window_at then private.redeem_limits.attempts+1 else 1 end,window_at=excluded.window_at
 returning attempts into n;
 if n>10 then return jsonb_build_object('ok',false,'error','Too many attempts. Try again later.'); end if;
 if p_code is null or length(p_code)>100 then return jsonb_build_object('ok',false,'error','Invalid or expired invitation.'); end if;
 select * into inv from private.invites where code_hash=encode(sha256(convert_to(upper(trim(p_code)),'UTF8')),'hex') for update;
 if not found or inv.revoked or inv.expires_at<=now() or inv.uses>=inv.max_uses then
  return jsonb_build_object('ok',false,'error','Invalid, expired or exhausted invitation.');
 end if;
 insert into private.memberships(user_id) values(uid);
 update private.invites set uses=uses+1 where id=inv.id;
 insert into public.profiles(id) values(uid) on conflict(id) do nothing;
 return jsonb_build_object('ok',true);
end;
$$;
create or replace function public.admin_create_invite(p_label text,p_max_uses int,p_days int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; ident uuid;
begin
 if not exists(select 1 from private.memberships where user_id=auth.uid() and active and role='admin') then raise exception 'Admin only'; end if;
 if p_max_uses is null or p_max_uses not between 1 and 100 or p_days is null or p_days not between 1 and 365 then raise exception 'Invalid limits'; end if;
 code:='MED-'||upper(replace(gen_random_uuid()::text,'-',''));
 insert into private.invites(code_hash,label,max_uses,expires_at)
 values(encode(sha256(convert_to(code,'UTF8')),'hex'),left(coalesce(p_label,''),80),p_max_uses,now()+make_interval(days=>p_days)) returning id into ident;
 return jsonb_build_object('id',ident,'code',code);
end;
$$;
create or replace function public.admin_list_invites()
returns table(id uuid,label text,max_uses int,uses int,expires_at timestamptz,revoked boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from private.memberships m where m.user_id=auth.uid() and m.active and m.role='admin') then raise exception 'Admin only'; end if;
 return query select i.id,i.label,i.max_uses,i.uses,i.expires_at,i.revoked,i.created_at from private.invites i order by i.created_at desc limit 500;
end;
$$;
create or replace function public.admin_revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.memberships where user_id=auth.uid() and active and role='admin') then raise exception 'Admin only'; end if;
 update private.invites set revoked=true where id=p_id;
end;
$$;
create or replace function public.admin_list_members()
returns table(id uuid,email text,nickname text,role text,active boolean,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from private.memberships m where m.user_id=auth.uid() and m.active and m.role='admin') then raise exception 'Admin only'; end if;
 return query select m.user_id,u.email::text,coalesce(p.nickname,'Student'),m.role,m.active,m.joined_at
 from private.memberships m join auth.users u on u.id=m.user_id left join public.profiles p on p.id=m.user_id order by m.joined_at desc limit 1000;
end;
$$;
create or replace function public.admin_set_member(p_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.memberships where user_id=auth.uid() and active and role='admin') then raise exception 'Admin only'; end if;
 if p_active is null then raise exception 'Invalid status'; end if;
 update private.memberships set active=p_active where user_id=p_id and role='student';
end;
$$;
revoke all on function public.member_status(),public.is_active_member(),public.redeem_invite(text),public.admin_create_invite(text,int,int),public.admin_list_invites(),public.admin_revoke_invite(uuid),public.admin_list_members(),public.admin_set_member(uuid,boolean) from public,anon,authenticated;
grant execute on function public.member_status(),public.is_active_member(),public.redeem_invite(text),public.admin_create_invite(text,int,int),public.admin_list_invites(),public.admin_revoke_invite(uuid),public.admin_list_members(),public.admin_set_member(uuid,boolean) to authenticated;

-- Restrictive policies combine with the pre-existing ownership policies.
drop policy if exists "members only" on public.profiles;
create policy "members only" on public.profiles as restrictive for all to authenticated using((select public.is_active_member())) with check((select public.is_active_member()));
drop policy if exists "members only" on public.progress;
create policy "members only" on public.progress as restrictive for all to authenticated using((select public.is_active_member())) with check((select public.is_active_member()));
drop policy if exists "members only" on public.mock_results;
create policy "members only" on public.mock_results as restrictive for all to authenticated using((select public.is_active_member())) with check((select public.is_active_member()));
-- Browser-reported study-mode scores are explicitly motivational, not formal exam results.
create table if not exists public.study_results(
 user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id uuid not null,
 paper text not null check(paper in ('A','B')),
 correct int not null check(correct between 0 and 120),
 answered int not null check(answered between 0 and 120 and answered>=correct),
 completed_at timestamptz not null default now(),
 primary key(user_id,attempt_id)
);
alter table public.study_results enable row level security;
drop policy if exists "study read own" on public.study_results;
create policy "study read own" on public.study_results for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_member()));
drop policy if exists "study insert own" on public.study_results;
create policy "study insert own" on public.study_results for insert to authenticated with check(user_id=(select auth.uid()) and (select public.is_active_member()) and answered=120);
revoke all on public.study_results from public,anon,authenticated;
grant select,insert on public.study_results to authenticated;
create or replace function public.get_leaderboard()
returns table(nickname text,best_score integer,attempts integer)
language sql stable security definer set search_path='' as $$
 select p.nickname,max(r.correct)::int,count(*)::int
 from public.profiles p join private.memberships m on m.user_id=p.id and m.active
 join public.study_results r on r.user_id=p.id
 where p.leaderboard_visible and public.is_active_member() and r.answered=120
 group by p.id,p.nickname order by max(r.correct) desc,count(*) desc,p.nickname asc limit 100;
$$;
revoke all on function public.get_leaderboard() from public,anon,authenticated;
grant execute on function public.get_leaderboard() to authenticated;
create or replace function public.get_study_leaderboard(p_paper text default 'All')
returns table(nickname text,best_score integer,attempts integer)
language sql stable security definer set search_path='' as $$
 select p.nickname,max(r.correct)::int,count(*)::int
 from public.profiles p join private.memberships m on m.user_id=p.id and m.active
 join public.study_results r on r.user_id=p.id
 where p.leaderboard_visible and public.is_active_member() and r.answered=120
 and (p_paper='All' or r.paper=p_paper)
 group by p.id,p.nickname order by max(r.correct) desc,count(*) desc,p.nickname asc limit 100;
$$;
revoke all on function public.get_study_leaderboard(text) from public,anon,authenticated;
grant execute on function public.get_study_leaderboard(text) to authenticated;
commit;

-- Bootstrap owner ONLY after confirming your own email account:
-- insert into private.memberships(user_id,role,active)
-- select id,'admin',true from auth.users where lower(email)=lower('YOUR_EMAIL_HERE') and email_confirmed_at is not null
-- on conflict(user_id) do update set role='admin',active=true;

