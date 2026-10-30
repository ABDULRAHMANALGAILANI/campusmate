-- ============================================================
-- CampusMate: tidy up tables left over from early versions
--
--   queue_reports              (old "queue" feature, removed)
--   group_attendance_sessions  (old attendance, replaced by
--   group_attendance_checkins   attendance_sessions/_records)
--   attendance                 (old attendance, same)
--
-- Safe: an EMPTY table is removed. A table that still has rows
-- is only renamed to old_<name>, so nothing is lost. You can
-- delete those later in Table Editor if you don't need them.
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

drop table if exists cleanup_result;
create temporary table cleanup_result (tbl text, result text);

do $$
declare
  t      text;
  n      bigint;
begin
  foreach t in array array[
    'queue_reports',
    'group_attendance_checkins',   -- before sessions (it points at them)
    'group_attendance_sessions',
    'attendance'
  ]
  loop
    if to_regclass('public.' || t) is null then
      insert into cleanup_result values (t, 'not found (already gone)');
      continue;
    end if;

    execute format('select count(*) from public.%I', t) into n;

    if n = 0 then
      execute format('drop table public.%I cascade', t);
      insert into cleanup_result values (t, 'empty -> removed');
    else
      execute format('alter table public.%I rename to %I', t, 'old_' || t);
      insert into cleanup_result values (t, n || ' rows -> kept as old_' || t);
    end if;
  end loop;

  -- Trigger function of the old attendance table, if nothing uses it now
  if exists (select 1 from pg_proc where proname = 'protect_attendance_fields')
     and not exists (
       select 1 from pg_trigger tg
       join pg_proc p on p.oid = tg.tgfoid
       where p.proname = 'protect_attendance_fields'
     ) then
    drop function if exists public.protect_attendance_fields() cascade;
    insert into cleanup_result values ('protect_attendance_fields()', 'unused -> removed');
  end if;
end;
$$;

-- What happened
select * from cleanup_result;
