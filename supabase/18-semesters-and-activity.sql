-- ============================================================
-- CampusMate: semesters, archived classes, activity log
--
--   1. Each class can have a semester (e.g. "Sem 1 2026/2027").
--   2. The class owner can ARCHIVE a class at the end of the
--      semester. It becomes read-only: nothing can be posted,
--      handed in, marked or changed, and it drops out of the
--      normal class lists. Marks and records are kept.
--      Un-archiving makes it editable again.
--   3. Activity log: who changed a mark, attendance, an excuse,
--      an assignment or the class list, and when.
--      Teachers of the class see it; a student sees the entries
--      about themselves.
--
-- Run AFTER 17-cleanup-old-tables.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ============================================================
-- 1. SEMESTER + ARCHIVE
-- ============================================================

alter table public.course_groups
  add column if not exists semester    text,
  add column if not exists archived_at timestamptz;

alter table public.course_groups
  drop constraint if exists course_groups_semester_check;

alter table public.course_groups
  add constraint course_groups_semester_check
  check (semester is null or length(semester) <= 60)
  not valid;


create or replace function public.class_is_archived(gid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select archived_at is not null from public.course_groups where id = gid), false);
$$;

revoke execute on function public.class_is_archived(uuid) from public, anon;
grant  execute on function public.class_is_archived(uuid) to authenticated, service_role;


-- OWNER: set the semester, archive or un-archive
create or replace function public.set_class_semester(input_group_id uuid, input_semester text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_class_owner(input_group_id) then
    raise exception 'Only the professor who owns this class can change its semester.';
  end if;

  update public.course_groups
  set semester = nullif(left(trim(coalesce(input_semester, '')), 60), '')
  where id = input_group_id;
end;
$$;


create or replace function public.set_class_archived(input_group_id uuid, input_archived boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_class_owner(input_group_id) then
    raise exception 'Only the professor who owns this class can archive it.';
  end if;

  -- close any attendance still open (before it becomes read-only)
  if input_archived then
    update public.attendance_sessions
    set is_active = false, closed_at = coalesce(closed_at, now())
    where group_id = input_group_id and is_active;
  end if;

  update public.course_groups
  set archived_at = case when input_archived then coalesce(archived_at, now()) else null end,
      -- nobody can join an archived class
      is_active   = case when input_archived then false else is_active end
  where id = input_group_id;
end;
$$;

revoke execute on function public.set_class_semester(uuid, text)    from public, anon;
revoke execute on function public.set_class_archived(uuid, boolean) from public, anon;
grant  execute on function public.set_class_semester(uuid, text)    to authenticated, service_role;
grant  execute on function public.set_class_archived(uuid, boolean) to authenticated, service_role;


-- Read-only guard (named zz_... so it runs after the other
-- "before" checks have filled in the class). Fires for requests from the app (signed-in
-- users), including through database functions. The SQL editor,
-- the server key and account deletion are not blocked.
create or replace function public.block_archived_class_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gid uuid;
begin
  if coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  gid := case when tg_op = 'DELETE' then old.group_id else new.group_id end;

  -- Deleting the whole class removes its rows: allow that
  if tg_op = 'DELETE' and not exists (select 1 from public.course_groups where id = gid) then
    return old;
  end if;

  if public.class_is_archived(gid) then
    raise exception 'This class is archived, so it can''t be changed. The class owner can un-archive it.';
  end if;

  return coalesce(new, old);
end;
$$;


do $$
declare
  t text;
begin
  foreach t in array array[
    'course_posts', 'class_assignments', 'assignment_submissions', 'assignment_marks',
    'attendance_sessions', 'attendance_records', 'attendance_excuses',
    'course_questions', 'course_answers', 'class_meetings', 'quizzes', 'quiz_attempts',
    'course_group_members', 'course_group_teachers'
  ]
  loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop trigger if exists block_archived_class_changes on public.%I', t);
    execute format('drop trigger if exists zz_block_archived_class_changes on public.%I', t);
    execute format(
      'create trigger zz_block_archived_class_changes before insert or update or delete on public.%I
       for each row execute function public.block_archived_class_changes()', t);
  end loop;
end;
$$;


-- ============================================================
-- 2. ACTIVITY LOG
-- ============================================================

create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  group_id    uuid references public.course_groups(id) on delete cascade,
  actor_id    uuid,
  student_id  uuid,
  action      text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_group_idx   on public.activity_log (group_id, created_at desc);
create index if not exists activity_log_student_idx on public.activity_log (student_id, created_at desc);

alter table public.activity_log enable row level security;
revoke insert, update, delete on public.activity_log from anon, authenticated;

drop policy if exists "Activity: teachers, or the student it is about" on public.activity_log;

create policy "Activity: teachers, or the student it is about"
on public.activity_log for select to authenticated
using (public.is_class_professor(group_id) or student_id = auth.uid());


create or replace function public.log_activity(
  gid uuid, sid uuid, what text, extra jsonb
)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.activity_log (group_id, actor_id, student_id, action, details)
  select gid, auth.uid(), sid, what, coalesce(extra, '{}'::jsonb)
  where exists (select 1 from public.course_groups where id = gid);
$$;

revoke execute on function public.log_activity(uuid, uuid, text, jsonb) from public, anon, authenticated;


-- Marks
create or replace function public.log_mark_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  title text;
begin
  select a.title into title
  from public.class_assignments a
  where a.id = coalesce(new.assignment_id, old.assignment_id);

  if tg_op = 'INSERT' then
    perform public.log_activity(new.group_id, new.student_id, 'mark_given',
      jsonb_build_object('assignment', title, 'to', new.grade));
  elsif tg_op = 'UPDATE' then
    if new.grade is distinct from old.grade then
      perform public.log_activity(new.group_id, new.student_id, 'mark_changed',
        jsonb_build_object('assignment', title, 'from', old.grade, 'to', new.grade));
    elsif new.feedback is distinct from old.feedback then
      perform public.log_activity(new.group_id, new.student_id, 'feedback_changed',
        jsonb_build_object('assignment', title));
    end if;
  else
    perform public.log_activity(old.group_id, old.student_id, 'mark_removed',
      jsonb_build_object('assignment', title, 'from', old.grade));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists log_mark_change on public.assignment_marks;
create trigger log_mark_change
after insert or update or delete on public.assignment_marks
for each row execute function public.log_mark_change();


-- Releasing / hiding marks, date changes, deleting an assignment
create or replace function public.log_assignment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    perform public.log_activity(old.group_id, null, 'assignment_deleted',
      jsonb_build_object('assignment', old.title));
    return old;
  end if;

  if new.marks_released is distinct from old.marks_released then
    perform public.log_activity(new.group_id, null,
      case when new.marks_released then 'marks_released' else 'marks_hidden' end,
      jsonb_build_object('assignment', new.title));
  end if;

  if new.due_at is distinct from old.due_at then
    perform public.log_activity(new.group_id, null, 'due_date_changed',
      jsonb_build_object('assignment', new.title, 'from', old.due_at, 'to', new.due_at));
  end if;

  if new.weight is distinct from old.weight then
    perform public.log_activity(new.group_id, null, 'weight_changed',
      jsonb_build_object('assignment', new.title, 'from', old.weight, 'to', new.weight));
  end if;

  return new;
end;
$$;

drop trigger if exists log_assignment_change on public.class_assignments;
create trigger log_assignment_change
after update or delete on public.class_assignments
for each row execute function public.log_assignment_change();


-- Attendance changed by a teacher (not the student's own check-in)
create or replace function public.log_attendance_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and auth.uid() <> new.student_id then
    perform public.log_activity(new.group_id, new.student_id, 'attendance_changed',
      jsonb_build_object('from', old.status, 'to', new.status, 'session_date', old.created_at));
  end if;
  return new;
end;
$$;

drop trigger if exists log_attendance_change on public.attendance_records;
create trigger log_attendance_change
after update on public.attendance_records
for each row execute function public.log_attendance_change();


-- Excuse decisions
create or replace function public.log_excuse_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending' then
    perform public.log_activity(new.group_id, new.student_id, 'excuse_' || new.status,
      jsonb_build_object('reason', left(new.reason, 120)));
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.attendance_excuses') is not null then
    drop trigger if exists log_excuse_decision on public.attendance_excuses;
    create trigger log_excuse_decision
    after update on public.attendance_excuses
    for each row execute function public.log_excuse_decision();
  end if;
end;
$$;


-- Students added to / removed from the class
create or replace function public.log_membership_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.group_id, new.student_id,
      case when auth.uid() = new.student_id then 'student_joined' else 'student_added' end, '{}');
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.group_id, old.student_id, 'student_removed', '{}');
  elsif new.status is distinct from old.status then
    perform public.log_activity(new.group_id, new.student_id,
      case when new.status = 'active' then 'student_added' else 'student_removed' end, '{}');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_membership_change on public.course_group_members;
create trigger log_membership_change
after insert or update or delete on public.course_group_members
for each row execute function public.log_membership_change();


-- Archive / semester
create or replace function public.log_class_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    perform public.log_activity(new.id, null,
      case when new.archived_at is null then 'class_unarchived' else 'class_archived' end, '{}');
  end if;
  if new.semester is distinct from old.semester then
    perform public.log_activity(new.id, null, 'semester_changed',
      jsonb_build_object('from', old.semester, 'to', new.semester));
  end if;
  return new;
end;
$$;

drop trigger if exists log_class_change on public.course_groups;
create trigger log_class_change
after update of archived_at, semester on public.course_groups
for each row execute function public.log_class_change();


-- Who did it (names) for the log screen
create or replace function public.class_activity(gid uuid, max_rows integer default 200)
returns table (
  id bigint, created_at timestamptz, action text, details jsonb,
  actor_name text, student_name text, student_campus_id text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id, l.created_at, l.action, l.details,
         a.full_name, s.full_name, s.campus_id
  from public.activity_log l
  left join public.profiles a on a.id = l.actor_id
  left join public.profiles s on s.id = l.student_id
  where l.group_id = gid
    and (public.is_class_professor(gid) or l.student_id = auth.uid())
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(max_rows, 200), 1), 1000);
$$;

revoke execute on function public.class_activity(uuid, integer) from public, anon;
grant  execute on function public.class_activity(uuid, integer) to authenticated, service_role;


-- "Download my data" / account deletion also cover the log
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
    ('activity_log',           'student_id'),
    ('queue_reports',          'user_id'),
    -- renamed by 17-cleanup-old-tables.sql when they still had rows
    ('old_queue_reports',      'user_id'),
    ('old_attendance',         'student_id'),
    ('old_group_attendance_checkins', 'student_id')
$$;


-- CHECK
select item, case when ok then 'ok' else 'MISSING' end as status
from (values
  ('archive columns', exists (select 1 from information_schema.columns
                              where table_name = 'course_groups' and column_name = 'archived_at')),
  ('read-only guard', exists (select 1 from pg_trigger where tgname = 'zz_block_archived_class_changes')),
  ('activity log',    to_regclass('public.activity_log') is not null)
) as t(item, ok);
