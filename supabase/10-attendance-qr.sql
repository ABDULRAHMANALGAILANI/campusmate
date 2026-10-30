-- ============================================================
-- CampusMate: attendance by QR only (professor generates it)
--
--   * The professor starts attendance. It stays open until
--     they click "Close Attendance" (no time window).
--   * The professor clicks "Generate QR". That QR works for
--     30 seconds (+5 seconds grace for a slow phone).
--     Late students? Generate another one.
--   * The typed attendance code is switched off.
--   * Old fixed QR links stop working.
--
-- Run AFTER 9-course-pages.sql and 11-fix-attendance-ambiguous.sql.
-- Replaces 10-rotating-qr.sql (cleans it up if you ran it).
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;


-- Clean up the earlier "changes every 30 seconds" version
drop function if exists public.current_attendance_qr(uuid);
drop function if exists public.attendance_qr_step();
drop table if exists public.attendance_qr_secrets;


-- ------------------------------------------------------------
-- One row per generated QR code
-- No policies = nobody reads it through the app directly.
-- ------------------------------------------------------------

create table if not exists public.attendance_qr_codes (
  code        text primary key,
  session_id  uuid not null references public.attendance_sessions(id) on delete cascade,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists attendance_qr_codes_session_idx
  on public.attendance_qr_codes (session_id);

alter table public.attendance_qr_codes enable row level security;
revoke all on public.attendance_qr_codes from anon, authenticated;


-- ------------------------------------------------------------
-- PROFESSOR: start attendance with no time limit
-- (kept open for up to 12 hours as a safety net)
-- ------------------------------------------------------------

create or replace function public.start_attendance_open(input_group_id uuid)
returns table (session_id uuid)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  new_id uuid;
begin
  select s.session_id into new_id
  from public.start_attendance_session(input_group_id, 120) s;

  update public.attendance_sessions
  set expires_at = now() + interval '12 hours'
  where id = new_id;

  return query select new_id;
end;
$$;


-- ------------------------------------------------------------
-- PROFESSOR: generate a QR code (works for 30 seconds)
-- ------------------------------------------------------------

create or replace function public.generate_attendance_qr(input_session_id uuid)
returns table (code text, expires_at timestamptz, seconds integer)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  the_session public.attendance_sessions;
  new_code    text := 'Q' || encode(extensions.gen_random_bytes(12), 'hex');
  new_expiry  timestamptz := now() + interval '30 seconds';
begin
  select * into the_session
  from public.attendance_sessions
  where id = input_session_id;

  if the_session.id is null
     or not public.is_class_professor(the_session.group_id) then
    raise exception 'Only this class''s professor can generate its QR code.';
  end if;

  if not the_session.is_active or the_session.closed_at is not null then
    raise exception 'This attendance session is closed. Start a new one.';
  end if;

  -- Tidy up codes older than a day
  delete from public.attendance_qr_codes
  where created_at < now() - interval '1 day';

  insert into public.attendance_qr_codes (code, session_id, expires_at)
  values (new_code, input_session_id, new_expiry);

  return query select new_code, new_expiry, 30;
end;
$$;


-- ------------------------------------------------------------
-- STUDENT: check in with a scanned QR code
-- ------------------------------------------------------------

drop function if exists public.check_in_attendance_by_qr(text);

create or replace function public.check_in_attendance_by_qr(input_code text)
returns table (group_name text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  found_code  public.attendance_qr_codes;
  the_session public.attendance_sessions;
begin
  select * into found_code
  from public.attendance_qr_codes
  where code = trim(coalesce(input_code, ''));

  if found_code.code is null then
    raise exception 'This QR code isn''t valid. Scan the code on your professor''s screen.';
  end if;

  if now() > found_code.expires_at + interval '5 seconds' then
    raise exception 'This QR code has expired. Ask your professor to generate a new one.';
  end if;

  select * into the_session
  from public.attendance_sessions
  where id = found_code.session_id;

  -- The existing check-in does the rest (student account,
  -- in this class, session still open).
  perform public.check_in_attendance_by_token(the_session.qr_token);

  return query
  select g.name::text
  from public.course_groups g
  where g.id = the_session.group_id;
end;
$$;


revoke execute on function public.start_attendance_open(uuid)       from public, anon;
revoke execute on function public.generate_attendance_qr(uuid)      from public, anon;
revoke execute on function public.check_in_attendance_by_qr(text)   from public, anon;
grant  execute on function public.start_attendance_open(uuid)       to authenticated, service_role;
grant  execute on function public.generate_attendance_qr(uuid)      to authenticated, service_role;
grant  execute on function public.check_in_attendance_by_qr(text)   to authenticated, service_role;


-- The app can no longer use the typed code or the old fixed QR
-- (only the functions above can, from inside the database).
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('check_in_attendance_by_token', 'check_in_attendance_by_code')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end;
$$;


-- CHECK: should list the 3 functions
select routine_name::text
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('start_attendance_open', 'generate_attendance_qr', 'check_in_attendance_by_qr')
order by 1;
