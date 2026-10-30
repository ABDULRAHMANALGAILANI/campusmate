-- ============================================================
-- CampusMate: "Download my data" and "Delete my account" (PDPA)
--
--   export_my_data()       anyone: everything CampusMate holds
--                          about them, as one JSON file
--   account_delete_block() why an account can't be deleted yet
--                          (e.g. a professor who still owns classes)
--   user_file_paths(uid)   server only: their uploaded files
--   delete_user_data(uid)  server only: removes their rows before
--                          the account itself is deleted
--
-- The actual deleting is done by the school-admin Edge Function
-- (redeploy it after running this file).
--
-- Run AFTER 15-privacy-and-help.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- Which tables hold a person's data, and in which column.
-- Tables that don't exist in your database are skipped.
create or replace function public.personal_data_tables()
returns table (table_name text, column_name text)
language sql
immutable
as $$
  values
    ('profiles',               'id'),
    ('user_settings',          'user_id'),
    ('professor_settings',     'user_id'),
    ('course_group_members',   'student_id'),
    ('professor_students',     'student_id'),
    ('professor_students',     'professor_id'),
    ('assignment_submissions', 'student_id'),
    ('attendance_records',     'student_id'),
    ('attendance',             'student_id'),
    ('attendance_excuses',     'student_id'),
    ('course_questions',       'author_id'),
    ('course_answers',         'author_id'),
    ('quiz_attempts',          'student_id'),
    ('notifications',          'user_id'),
    ('assignments',            'user_id'),
    ('calendar_events',        'user_id'),
    ('study_sessions',         'student_id'),
    ('group_projects',         'user_id'),
    ('friendships',            'sender_id'),
    ('friendships',            'receiver_id'),
    ('messages',               'sender_id'),
    ('messages',               'receiver_id'),
    ('professor_messages',     'student_id'),
    ('professor_messages',     'professor_id'),
    ('professor_meetings',     'student_id'),
    ('professor_meetings',     'professor_id'),
    ('project_team_members',   'student_id'),
    ('project_updates',        'student_id'),
    ('project_files',          'uploaded_by'),
    ('course_group_teachers',  'teacher_id'),
    ('problem_reports',        'user_id'),
    ('queue_reports',          'user_id'),
    -- renamed by 17-cleanup-old-tables.sql when they still had rows
    ('old_queue_reports',      'user_id'),
    ('old_attendance',         'student_id'),
    ('old_group_attendance_checkins', 'student_id')
$$;


create or replace function public.has_column(tbl text, col text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = tbl and column_name = col
  );
$$;


-- ------------------------------------------------------------
-- DOWNLOAD MY DATA
-- ------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  me     uuid := auth.uid();
  result jsonb;
  rows   jsonb;
  item   record;
  label  text;
begin
  if me is null then
    raise exception 'You must be logged in.';
  end if;

  result := jsonb_build_object(
    'exported_at', now(),
    'about', 'Everything CampusMate stores about you. Each section is one database table.',
    'account', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = me
    )
  );

  for item in select * from public.personal_data_tables()
  loop
    continue when not public.has_column(item.table_name, item.column_name);

    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where t.%I = $1',
      item.table_name, item.column_name
    )
    into rows
    using me;

    label := item.table_name
      || case
           when item.column_name in ('receiver_id', 'professor_id') and item.table_name <> 'professor_students'
           then '_received'
           when item.table_name = 'professor_students' and item.column_name = 'professor_id'
           then '_as_teacher'
           else ''
         end;

    result := result || jsonb_build_object(label, rows);
  end loop;

  -- Marks: only the ones already released to you
  if to_regclass('public.assignment_marks') is not null then
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into rows
    from public.assignment_marks m
    where m.student_id = me and public.marks_are_released(m.assignment_id);

    result := result || jsonb_build_object('assignment_marks', rows);
  end if;

  return result;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant  execute on function public.export_my_data() to authenticated, service_role;


-- ------------------------------------------------------------
-- CAN THIS ACCOUNT BE DELETED?
-- ------------------------------------------------------------

create or replace function public.account_delete_block(target uuid default null)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  who uuid := coalesce(target, auth.uid());
  owned integer;
begin
  -- Only yourself, or the server
  if target is not null and target <> auth.uid()
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Not allowed.';
  end if;

  select count(*) into owned from public.course_groups where professor_id = who;

  if owned > 0 then
    return 'owns_classes:' || owned;
  end if;

  return null;
end;
$$;

revoke execute on function public.account_delete_block(uuid) from public, anon;
grant  execute on function public.account_delete_block(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- SERVER ONLY: files and rows to remove
-- ------------------------------------------------------------

create or replace function public.user_file_paths(target uuid)
returns table (bucket text, path text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  return query
  select 'submissions'::text, s.file_path
  from public.assignment_submissions s
  where s.student_id = target and s.file_path is not null;

  if to_regclass('public.attendance_excuses') is not null then
    return query
    select 'excuses'::text, e.file_path
    from public.attendance_excuses e
    where e.student_id = target and e.file_path is not null;
  end if;

  if public.has_column('profiles', 'avatar_path') then
    return query
    select 'avatars'::text, p.avatar_path
    from public.profiles p
    where p.id = target and p.avatar_path is not null;
  end if;
end;
$$;


create or replace function public.delete_user_data(target uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  item    record;
  removed integer := 0;
  n       integer;
begin
  if public.account_delete_block(target) is not null then
    raise exception 'This account still owns classes. Delete them or hand them over first.';
  end if;

  -- profiles last (other rows may point at it)
  for item in
    select * from public.personal_data_tables() order by (table_name = 'profiles')
  loop
    continue when not public.has_column(item.table_name, item.column_name);

    execute format('delete from public.%I where %I = $1', item.table_name, item.column_name)
    using target;

    get diagnostics n = row_count;
    removed := removed + n;
  end loop;

  if to_regclass('public.assignment_marks') is not null then
    delete from public.assignment_marks where student_id = target;
  end if;

  return removed;
end;
$$;

revoke execute on function public.user_file_paths(uuid)  from public, anon, authenticated;
revoke execute on function public.delete_user_data(uuid) from public, anon, authenticated;
grant  execute on function public.user_file_paths(uuid)  to service_role;
grant  execute on function public.delete_user_data(uuid) to service_role;


-- CHECK: should list 3 functions
select routine_name::text
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('export_my_data', 'account_delete_block', 'delete_user_data')
order by 1;
