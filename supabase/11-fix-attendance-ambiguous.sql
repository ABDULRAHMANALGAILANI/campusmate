-- ============================================================
-- CampusMate: fix "column reference session_id is ambiguous"
--
-- Problem: start_attendance_session and the two check-in
-- functions return a column called session_id, and they also
-- use the table column attendance_records.session_id. Postgres
-- can't tell which one "session_id" means, so starting
-- attendance (and checking in) fails.
--
-- Fix: add one line to each function telling Postgres to
-- always mean the TABLE column. Nothing else in them changes.
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

do $$
declare
  fn         record;
  definition text;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'start_attendance_session',
        'check_in_attendance_by_code',
        'check_in_attendance_by_token'
      )
  loop
    definition := pg_get_functiondef(fn.oid);

    if position('#variable_conflict' in definition) = 0 then
      -- Put the line right after the opening $function$
      definition := regexp_replace(
        definition,
        'AS \$function\$',
        E'AS $function$\n#variable_conflict use_column',
        ''
      );

      execute definition;
      raise notice 'Fixed %', fn.proname;
    else
      raise notice 'Already fixed %', fn.proname;
    end if;
  end loop;
end;
$$;


-- CHECK: all three should say "fixed"
select
  p.proname as function_name,
  case
    when position('#variable_conflict use_column' in pg_get_functiondef(p.oid)) > 0
    then 'fixed'
    else 'NOT fixed'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'start_attendance_session',
    'check_in_attendance_by_code',
    'check_in_attendance_by_token'
  )
order by 1;
