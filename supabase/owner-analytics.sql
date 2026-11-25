-- Run once in the existing Supabase SQL Editor as postgres.
-- Pins the ONLY existing active confirmed administrator by immutable user ID.
-- Aborts without changing anything if there is not exactly one administrator.
begin;
lock table private.memberships in share row exclusive mode;
create table if not exists private.owner_lock(
 singleton boolean primary key default true check(singleton),
 user_id uuid not null
);
revoke all on private.owner_lock from public,anon,authenticated;
do $$
declare owner_id uuid;
begin
 select user_id into owner_id from private.owner_lock where singleton;
 if owner_id is null then
  if (select count(*) from private.memberships where role='admin') <> 1 then
   raise exception 'Expected exactly one existing administrator. Review memberships before running this migration.';
  end if;
  select m.user_id into owner_id from private.memberships m join auth.users u on u.id=m.user_id
   where m.role='admin' and m.active and u.email_confirmed_at is not null;
  if owner_id is null then raise exception 'Existing owner must be active and confirmed'; end if;
  insert into private.owner_lock(singleton,user_id) values(true,owner_id);
 end if;
 if not exists(select 1 from private.memberships where user_id=owner_id and role='admin' and active) then
  raise exception 'Pinned owner is not an active administrator';
 end if;
 if exists(select 1 from private.memberships where role='admin' and user_id<>owner_id) then
  raise exception 'Unexpected additional administrator';
 end if;
end $$;
create unique index if not exists one_administrator_only on private.memberships(role) where role='admin';
create or replace function private.enforce_owner_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='admin' and not exists(select 1 from private.owner_lock where singleton and user_id=new.user_id) then
  raise exception 'Administrator role is reserved for the original owner';
 end if;
 return new;
end $$;
revoke all on function private.enforce_owner_role() from public,anon,authenticated;
drop trigger if exists enforce_owner_role on private.memberships;
create trigger enforce_owner_role before insert or update on private.memberships
 for each row execute function private.enforce_owner_role();

create table if not exists private.nickname_history(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null,
 recorded_at timestamptz not null default now()
);
create index if not exists nickname_history_user_idx on private.nickname_history(user_id,recorded_at desc);
revoke all on private.nickname_history from public,anon,authenticated;
insert into private.nickname_history(user_id,nickname)
 select p.id,p.nickname from public.profiles p
 where not exists(select 1 from private.nickname_history h where h.user_id=p.id);
create or replace function private.record_nickname()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into private.nickname_history(user_id,nickname) values(new.id,new.nickname);
 elsif new.nickname is distinct from old.nickname then
  insert into private.nickname_history(user_id,nickname) values(new.id,new.nickname);
 end if;
 return new;
end $$;
revoke all on function private.record_nickname() from public,anon,authenticated;
drop trigger if exists record_nickname on public.profiles;
create trigger record_nickname after insert or update of nickname on public.profiles
 for each row execute function private.record_nickname();

create or replace function private.require_owner()
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from private.owner_lock o join private.memberships m on m.user_id=o.user_id
 where o.singleton and m.user_id=auth.uid() and m.role='admin' and m.active) then
  raise exception 'Owner only' using errcode='42501';
 end if;
end $$;
revoke all on function private.require_owner() from public,anon,authenticated;

create or replace function public.owner_analytics()
returns table(id uuid,email text,nickname text,active boolean,visible boolean,joined_at timestamptz,last_login timestamptz,last_sync timestamptz,last_mock timestamptz,questions int,correct int,best_a int,best_b int,attempts int,legacy_attempts int)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_owner();
 return query
 select m.user_id,u.email::text,coalesce(p.nickname,'Student'),m.active,coalesce(p.leaderboard_visible,false),
 m.joined_at,u.last_sign_in_at,g.updated_at,r.last_mock,q.questions,q.correct,r.best_a,r.best_b,r.attempts,l.attempts
 from private.memberships m join auth.users u on u.id=m.user_id
 left join public.profiles p on p.id=m.user_id
 left join public.progress g on g.user_id=m.user_id
 left join lateral (
  select count(*) filter(where jsonb_typeof(a.value->'correct')='boolean')::int as questions,
   count(*) filter(where a.value->'correct'='true'::jsonb)::int as correct
  from jsonb_each(case when jsonb_typeof(g.snapshot->'caseAnswers')='object' then g.snapshot->'caseAnswers' else '{}'::jsonb end) a
 ) q on true
 left join lateral (
  select max(s.completed_at) as last_mock,max(s.correct) filter(where s.paper='A') as best_a,
   max(s.correct) filter(where s.paper='B') as best_b,count(*)::int as attempts
  from public.study_results s where s.user_id=m.user_id and s.answered=120
 ) r on true
 left join lateral (select count(*)::int as attempts from public.mock_results s where s.user_id=m.user_id) l on true
 where m.role='student' order by m.joined_at desc;
end $$;

create or replace function public.owner_student_history(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_owner();
 if not exists(select 1 from private.memberships where user_id=p_id and role='student') then
  raise exception 'Student not found';
 end if;
 return jsonb_build_object(
 'study',coalesce((select jsonb_agg(to_jsonb(t) order by t.completed_at desc) from (
   select s.paper,s.correct,s.answered,s.completed_at from public.study_results s where s.user_id=p_id order by s.completed_at desc limit 500
 ) t),'[]'::jsonb),
 'legacy',coalesce((select jsonb_agg(to_jsonb(t) order by t.completed_at desc) from (
   select s.paper,s.correct,s.total,s.completed_at from public.mock_results s where s.user_id=p_id order by s.completed_at desc limit 500
 ) t),'[]'::jsonb),
 'nicknames',coalesce((select jsonb_agg(to_jsonb(t) order by t.recorded_at desc) from (
   select h.nickname,h.recorded_at from private.nickname_history h where h.user_id=p_id order by h.recorded_at desc,h.id desc limit 500
 ) t),'[]'::jsonb)
 );
end $$;
revoke all on function public.owner_analytics(),public.owner_student_history(uuid) from public,anon,authenticated;
grant execute on function public.owner_analytics(),public.owner_student_history(uuid) to authenticated;
commit;
-- Verify the owner is YOUR existing email; there should be exactly one row.
select u.email,m.role,m.active from private.owner_lock o join auth.users u on u.id=o.user_id
 join private.memberships m on m.user_id=o.user_id;
