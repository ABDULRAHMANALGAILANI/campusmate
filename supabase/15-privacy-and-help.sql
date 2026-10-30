-- ============================================================
-- CampusMate: privacy agreement + "Report a problem"
--
--   1. Each profile records which Privacy Notice version the
--      person agreed to, and when (PDPA).
--   2. problem_reports: messages sent from the Help page.
--      The person who sent it can read their own reports; the
--      school admin can read reports from their school.
--      You read them all in Supabase -> Table Editor.
--
-- Run AFTER 14-real-classroom.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PRIVACY AGREEMENT
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists privacy_version     text,
  add column if not exists privacy_accepted_at timestamptz;


create or replace function public.accept_privacy(input_version text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if coalesce(trim(input_version), '') = '' or length(input_version) > 40 then
    raise exception 'Unknown privacy notice version.';
  end if;

  update public.profiles
  set privacy_version     = trim(input_version),
      privacy_accepted_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.accept_privacy(text) from public, anon;
grant  execute on function public.accept_privacy(text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. REPORT A PROBLEM
-- ------------------------------------------------------------

create table if not exists public.problem_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id   uuid,
  category    text not null default 'bug'
              check (category in ('bug', 'marks', 'account', 'privacy', 'idea')),
  message     text not null check (length(trim(message)) between 5 and 4000),
  page        text check (page is null or length(page) <= 300),
  device      text check (device is null or length(device) <= 300),
  status      text not null default 'open'
              check (status in ('open', 'in_progress', 'fixed', 'closed')),
  reply       text check (reply is null or length(reply) <= 4000),
  created_at  timestamptz not null default now()
);

create index if not exists problem_reports_user_idx on public.problem_reports (user_id, created_at desc);

alter table public.problem_reports enable row level security;


-- The sender can't set the status/reply; their school is filled in
create or replace function public.guard_problem_report()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id   := coalesce(auth.uid(), new.user_id);
    new.status    := 'open';
    new.reply     := null;
    new.school_id := (select school_id from public.profiles where id = new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists guard_problem_report on public.problem_reports;

create trigger guard_problem_report
before insert on public.problem_reports
for each row
execute function public.guard_problem_report();


create or replace function public.is_school_admin_of(sid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select sid is not null and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'school_admin' and school_id = sid
  );
$$;

revoke execute on function public.is_school_admin_of(uuid) from public, anon;
grant  execute on function public.is_school_admin_of(uuid) to authenticated, service_role;


drop policy if exists "Reports: send your own"              on public.problem_reports;
drop policy if exists "Reports: read your own or school's"  on public.problem_reports;
drop policy if exists "Reports: school admin updates"       on public.problem_reports;

create policy "Reports: send your own"
on public.problem_reports for insert to authenticated
with check (user_id = auth.uid());

create policy "Reports: read your own or school's"
on public.problem_reports for select to authenticated
using (user_id = auth.uid() or public.is_school_admin_of(school_id));

create policy "Reports: school admin updates"
on public.problem_reports for update to authenticated
using (public.is_school_admin_of(school_id))
with check (public.is_school_admin_of(school_id));


-- CHECK: both lines should say ok
select 'privacy columns' as item,
       case when count(*) = 2 then 'ok' else 'MISSING' end as status
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('privacy_version', 'privacy_accepted_at')
union all
select 'problem reports',
       case when to_regclass('public.problem_reports') is not null then 'ok' else 'MISSING' end;
