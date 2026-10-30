-- ============================================================
-- CampusMate: real classroom features
--
--   1. Edit assignments (students are told when the date changes)
--   2. Files on assignments (question sheet, template)
--   3. Add a whole list of students to a class at once
--   4. Co-lecturers and tutors (they can mark + take attendance)
--   5. Weights, final grade, and "release marks" when ready
--   6. Absence excuses (MC upload, professor accepts/rejects)
--   7. Questions & answers per class
--   8. Class timetable (day, time, room)
--   9. Online quizzes (multiple choice, marked automatically)
--  10. Search across all your classes
--
-- Run AFTER 13-late-work-and-reminders.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ============================================================
-- 0. NOTIFICATION TYPES
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_category_check;

alter table public.notifications
  add constraint notifications_category_check
  check (
    category is null
    or category in (
      'assignment', 'project', 'attendance',
      'announcement', 'material', 'marked', 'general',
      'question', 'quiz', 'excuse', 'timetable'
    )
  )
  not valid;


-- ============================================================
-- 1. CO-LECTURERS AND TUTORS
-- ============================================================

create table if not exists public.course_group_teachers (
  group_id    uuid not null references public.course_groups(id) on delete cascade,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Co-lecturer'
              check (title in ('Co-lecturer', 'Tutor')),
  added_by    uuid default auth.uid(),
  added_at    timestamptz not null default now(),
  primary key (group_id, teacher_id)
);

create index if not exists course_group_teachers_teacher_idx
  on public.course_group_teachers (teacher_id);

alter table public.course_group_teachers enable row level security;
revoke insert, update, delete on public.course_group_teachers from anon, authenticated;


-- Is the logged-in user the professor who OWNS this class?
create or replace function public.is_class_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.course_groups
    where id = gid and professor_id = auth.uid()
  );
$$;

-- Is the logged-in user a teacher of this class?
-- (owner, co-lecturer or tutor). Used everywhere a professor
-- is allowed to do something in a class.
create or replace function public.is_class_professor(gid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.course_groups
    where id = gid and professor_id = auth.uid()
  )
  or exists (
    select 1 from public.course_group_teachers
    where group_id = gid and teacher_id = auth.uid()
  );
$$;

revoke execute on function public.is_class_owner(uuid) from public, anon;
grant  execute on function public.is_class_owner(uuid) to authenticated, service_role;


drop policy if exists "Class can see its teachers" on public.course_group_teachers;

create policy "Class can see its teachers"
on public.course_group_teachers for select to authenticated
using (public.is_class_professor(group_id) or public.is_class_student(group_id));


-- Teachers can see and work in the classes they teach
drop policy if exists "Teachers can view their classes"           on public.course_groups;
drop policy if exists "Teachers can view class members"           on public.course_group_members;
drop policy if exists "Teachers can view class assignments"       on public.class_assignments;
drop policy if exists "Teachers can create class assignments"     on public.class_assignments;
drop policy if exists "Teachers can update class assignments"     on public.class_assignments;
drop policy if exists "Teachers can delete class assignments"     on public.class_assignments;
drop policy if exists "Teachers can view attendance sessions"     on public.attendance_sessions;
drop policy if exists "Teachers can view attendance records"      on public.attendance_records;

create policy "Teachers can view their classes"
on public.course_groups for select to authenticated
using (public.is_class_professor(id));

create policy "Teachers can view class members"
on public.course_group_members for select to authenticated
using (public.is_class_professor(group_id));

create policy "Teachers can view class assignments"
on public.class_assignments for select to authenticated
using (public.is_class_professor(group_id));

create policy "Teachers can create class assignments"
on public.class_assignments for insert to authenticated
with check (professor_id = auth.uid() and public.is_class_professor(group_id));

create policy "Teachers can update class assignments"
on public.class_assignments for update to authenticated
using (public.is_class_professor(group_id))
with check (public.is_class_professor(group_id));

create policy "Teachers can delete class assignments"
on public.class_assignments for delete to authenticated
using (public.is_class_professor(group_id));

create policy "Teachers can view attendance sessions"
on public.attendance_sessions for select to authenticated
using (public.is_class_professor(group_id));

create policy "Teachers can view attendance records"
on public.attendance_records for select to authenticated
using (public.is_class_professor(group_id));


-- Links a teacher to students so they can chat (Chat & Meetings)
create or replace function public.link_teacher_students(gid uuid, tid uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.professor_students (professor_id, student_id)
  select tid, m.student_id
  from public.course_group_members m
  where m.group_id = gid
    and m.status = 'active'
    and not exists (
      select 1 from public.professor_students ps
      where ps.professor_id = tid and ps.student_id = m.student_id
    );
$$;

revoke execute on function public.link_teacher_students(uuid, uuid) from public, anon, authenticated;


-- OWNER: add a co-lecturer or tutor by CampusMate ID (PRO-...) or email
create or replace function public.add_class_teacher(
  input_group_id uuid,
  input_who      text,
  input_title    text default 'Co-lecturer'
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  clean      text := trim(coalesce(input_who, ''));
  owner_id   uuid;
  owner_school uuid;
  found      public.profiles;
begin
  select professor_id into owner_id
  from public.course_groups where id = input_group_id;

  if owner_id is null or owner_id <> auth.uid() then
    raise exception 'Only the professor who owns this class can add teachers.';
  end if;

  if input_title not in ('Co-lecturer', 'Tutor') then
    raise exception 'Choose Co-lecturer or Tutor.';
  end if;

  if clean = '' then
    raise exception 'Enter their CampusMate ID (PRO-...) or email.';
  end if;

  select p.* into found
  from public.profiles p
  left join auth.users u on u.id = p.id
  where upper(trim(p.campus_id)) = upper(clean)
     or lower(u.email) = lower(clean)
  limit 1;

  if found.id is null then
    raise exception 'No CampusMate account found for %.', clean;
  end if;

  if found.role <> 'professor' then
    raise exception '% is not a professor account. Tutors need a professor account too.', coalesce(found.full_name, clean);
  end if;

  if found.id = owner_id then
    raise exception 'You already own this class.';
  end if;

  select school_id into owner_school from public.profiles where id = owner_id;

  if owner_school is not null and found.school_id is distinct from owner_school then
    raise exception '% is not in your school.', found.full_name;
  end if;

  insert into public.course_group_teachers (group_id, teacher_id, title, added_by)
  values (input_group_id, found.id, input_title, auth.uid())
  on conflict (group_id, teacher_id)
  do update set title = excluded.title;

  perform public.link_teacher_students(input_group_id, found.id);

  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  values (
    found.id,
    'teacher_added_' || input_group_id || '_' || extract(epoch from now())::bigint,
    'You were added as ' || lower(input_title),
    public.class_label(input_group_id),
    'general',
    '/professor/classes/' || input_group_id,
    false
  );

  return found.full_name;
end;
$$;


-- OWNER: remove a co-lecturer/tutor (or a teacher leaves by themselves)
create or replace function public.remove_class_teacher(
  input_group_id   uuid,
  input_teacher_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_class_owner(input_group_id) or input_teacher_id = auth.uid()) then
    raise exception 'Only the professor who owns this class can remove teachers.';
  end if;

  delete from public.course_group_teachers
  where group_id = input_group_id
    and teacher_id = input_teacher_id;
end;
$$;

revoke execute on function public.add_class_teacher(uuid, text, text)  from public, anon;
revoke execute on function public.remove_class_teacher(uuid, uuid)     from public, anon;
grant  execute on function public.add_class_teacher(uuid, text, text)  to authenticated, service_role;
grant  execute on function public.remove_class_teacher(uuid, uuid)     to authenticated, service_role;


-- Participants now include co-lecturers and tutors.
-- role: professor (owner) | teacher | student
drop function if exists public.class_participants(uuid);

create function public.class_participants(gid uuid)
returns table (
  id          uuid,
  full_name   text,
  campus_id   text,
  programme   text,
  avatar_path text,
  role        text,
  title       text,
  joined_at   timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.campus_id, p.programme, p.avatar_path,
         'professor'::text, 'Professor'::text, g.created_at
  from public.course_groups g
  join public.profiles p on p.id = g.professor_id
  where g.id = gid
    and (public.is_class_professor(gid) or public.is_class_student(gid))

  union all

  select p.id, p.full_name, p.campus_id, p.programme, p.avatar_path,
         'teacher'::text, t.title, t.added_at
  from public.course_group_teachers t
  join public.profiles p on p.id = t.teacher_id
  where t.group_id = gid
    and (public.is_class_professor(gid) or public.is_class_student(gid))

  union all

  select p.id, p.full_name, p.campus_id, p.programme, p.avatar_path,
         'student'::text, 'Student'::text, m.joined_at
  from public.course_group_members m
  join public.profiles p on p.id = m.student_id
  where m.group_id = gid
    and m.status = 'active'
    and (public.is_class_professor(gid) or public.is_class_student(gid));
$$;

revoke execute on function public.class_participants(uuid) from public, anon;
grant  execute on function public.class_participants(uuid) to authenticated, service_role;


-- Classes I teach (own + co-teach), for the professor pages
create or replace function public.my_teaching_classes()
returns setof public.course_groups
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.*
  from public.course_groups g
  where g.professor_id = auth.uid()
     or exists (
       select 1 from public.course_group_teachers t
       where t.group_id = g.id and t.teacher_id = auth.uid()
     )
  order by g.created_at desc;
$$;

revoke execute on function public.my_teaching_classes() from public, anon;
grant  execute on function public.my_teaching_classes() to authenticated, service_role;


-- Notify every teacher of a class (owner + co-teachers)
create or replace function public.notify_class_teachers(
  gid       uuid,
  the_key   text,
  the_title text,
  the_msg   text,
  the_cat   text,
  the_link  text,
  skip_user uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  select t.uid, the_key, the_title, the_msg, the_cat, the_link, false
  from (
    select professor_id as uid from public.course_groups where id = gid
    union
    select teacher_id from public.course_group_teachers where group_id = gid
  ) t
  where t.uid is not null
    and t.uid is distinct from skip_user
    and not exists (
      select 1 from public.notifications n
      where n.user_id = t.uid and n.notification_key = the_key
    );
end;
$$;

revoke execute on function public.notify_class_teachers(uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;


-- Hand-in alerts now go to every teacher of the class
create or replace function public.notify_professor_hand_in()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a   public.class_assignments;
  who text;
begin
  select * into a from public.class_assignments where id = new.assignment_id;
  select full_name into who from public.profiles where id = new.student_id;

  perform public.notify_class_teachers(
    new.group_id,
    'handed_in_' || new.id || '_' || extract(epoch from now())::bigint,
    coalesce(who, 'A student') || ' handed in ' || coalesce(a.title, 'work'),
    public.class_label(new.group_id)
      || case
           when a.due_at is not null and new.submitted_at > a.due_at
           then ' · late'
           else ''
         end,
    'assignment',
    '/professor/classes/' || new.group_id
  );

  return new;
end;
$$;


-- ------------------------------------------------------------
-- Attendance: co-lecturers and tutors can take it too
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
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if not public.is_class_professor(input_group_id) then
    raise exception 'Only a teacher of this class can start attendance.';
  end if;

  update public.attendance_sessions
  set is_active = false,
      closed_at = coalesce(closed_at, now())
  where group_id = input_group_id
    and is_active = true;

  insert into public.attendance_sessions
    (group_id, professor_id, session_code, qr_token, expires_at, is_active)
  values (
    input_group_id,
    auth.uid(),
    public.generate_attendance_code(),
    gen_random_uuid(),
    now() + interval '12 hours',
    true
  )
  returning id into new_id;

  insert into public.attendance_records (session_id, group_id, student_id, status)
  select new_id, input_group_id, m.student_id, 'absent'
  from public.course_group_members m
  where m.group_id = input_group_id
    and m.status = 'active'
  on conflict (session_id, student_id) do nothing;

  return query select new_id;
end;
$$;


create or replace function public.close_attendance_session(input_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gid uuid;
begin
  select group_id into gid
  from public.attendance_sessions
  where id = input_session_id;

  if gid is null then
    raise exception 'Attendance session not found.';
  end if;

  if not public.is_class_professor(gid) then
    raise exception 'You cannot close this attendance session.';
  end if;

  update public.attendance_sessions
  set is_active = false,
      closed_at = coalesce(closed_at, now())
  where id = input_session_id;
end;
$$;


create or replace function public.professor_set_attendance_status(
  input_session_id uuid,
  input_student_id uuid,
  input_status     text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if input_status not in ('present', 'absent') then
    raise exception 'Status must be present or absent.';
  end if;

  select group_id into gid
  from public.attendance_sessions
  where id = input_session_id;

  if gid is null then
    raise exception 'Attendance session not found.';
  end if;

  if not public.is_class_professor(gid) then
    raise exception 'You cannot edit this attendance session.';
  end if;

  insert into public.attendance_records
    (session_id, group_id, student_id, status, checked_in_at, marked_by, updated_at)
  values (
    input_session_id, gid, input_student_id, input_status,
    case when input_status = 'present' then now() else null end,
    auth.uid(), now()
  )
  on conflict (session_id, student_id)
  do update set
    status        = input_status,
    checked_in_at = case
                      when input_status = 'present'
                      then coalesce(attendance_records.checked_in_at, now())
                      else null
                    end,
    marked_by     = auth.uid(),
    updated_at    = now();
end;
$$;

revoke execute on function public.start_attendance_open(uuid)                        from public, anon;
revoke execute on function public.close_attendance_session(uuid)                     from public, anon;
revoke execute on function public.professor_set_attendance_status(uuid, uuid, text)  from public, anon;
grant  execute on function public.start_attendance_open(uuid)                        to authenticated, service_role;
grant  execute on function public.close_attendance_session(uuid)                     to authenticated, service_role;
grant  execute on function public.professor_set_attendance_status(uuid, uuid, text)  to authenticated, service_role;


-- ============================================================
-- 2. ADD MANY STUDENTS AT ONCE
-- Accepts CampusMate IDs (STU-...), matric numbers or emails.
-- ============================================================

create or replace function public.add_students_to_class(
  input_group_id uuid,
  input_ids      text[]
)
returns table (input text, result text, student_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  owner_id     uuid;
  owner_school uuid;
  one          text;
  found        public.profiles;
  done         text[] := '{}';
begin
  if not public.is_class_professor(input_group_id) then
    raise exception 'Only a teacher of this class can add students.';
  end if;

  if coalesce(array_length(input_ids, 1), 0) > 500 then
    raise exception 'Add up to 500 students at a time.';
  end if;

  select professor_id into owner_id from public.course_groups where id = input_group_id;
  select school_id into owner_school from public.profiles where id = owner_id;

  foreach one in array coalesce(input_ids, '{}')
  loop
    one := trim(both ' ,;"' from coalesce(one, ''));

    continue when one = '' or upper(one) = any(done);
    done := done || upper(one);

    found := null;

    select p.* into found
    from public.profiles p
    left join auth.users u on u.id = p.id
    where upper(trim(p.campus_id)) = upper(one)
       or upper(trim(p.student_id)) = upper(one)
       or lower(u.email) = lower(one)
    order by (p.role = 'student') desc
    limit 1;

    if found.id is null then
      input := one; result := 'not_found'; student_name := null;
      return next;
      continue;
    end if;

    if found.role <> 'student' then
      input := one; result := 'not_student'; student_name := found.full_name;
      return next;
      continue;
    end if;

    if owner_school is not null and found.school_id is distinct from owner_school then
      input := one; result := 'other_school'; student_name := found.full_name;
      return next;
      continue;
    end if;

    if exists (
      select 1 from public.course_group_members m
      where m.group_id = input_group_id
        and m.student_id = found.id
        and m.status = 'active'
    ) then
      input := one; result := 'already'; student_name := found.full_name;
      return next;
      continue;
    end if;

    if exists (
      select 1 from public.course_group_members m
      where m.group_id = input_group_id and m.student_id = found.id
    ) then
      update public.course_group_members m
      set status = 'active', joined_at = now()
      where m.group_id = input_group_id and m.student_id = found.id;
    else
      insert into public.course_group_members (group_id, student_id, status, joined_at)
      values (input_group_id, found.id, 'active', now());
    end if;

    -- So the professor(s) can chat with the student
    insert into public.professor_students (professor_id, student_id)
    select t.uid, found.id
    from (
      select owner_id as uid
      union
      select teacher_id from public.course_group_teachers where group_id = input_group_id
    ) t
    where not exists (
      select 1 from public.professor_students ps
      where ps.professor_id = t.uid and ps.student_id = found.id
    );

    input := one; result := 'added'; student_name := found.full_name;
    return next;
  end loop;
end;
$$;

revoke execute on function public.add_students_to_class(uuid, text[]) from public, anon;
grant  execute on function public.add_students_to_class(uuid, text[]) to authenticated, service_role;


-- ============================================================
-- 3. ASSIGNMENTS: files, edit, weight, mark-only items, release
-- ============================================================

alter table public.class_assignments
  add column if not exists file_path      text,
  add column if not exists file_name      text,
  add column if not exists hand_in        boolean not null default true,
  add column if not exists weight         numeric(5, 2),
  add column if not exists marks_released boolean not null default true,
  add column if not exists updated_at     timestamptz;

-- Existing assignments keep showing marks; new ones start hidden
-- until the professor clicks "Release marks".
alter table public.class_assignments
  alter column marks_released set default false;

alter table public.class_assignments
  drop constraint if exists class_assignments_weight_check;

alter table public.class_assignments
  add constraint class_assignments_weight_check
  check (weight is null or (weight >= 0 and weight <= 100))
  not valid;


-- Rules of an assignment (reads past RLS)
create or replace function public.assignment_rules(aid uuid)
returns table (group_id uuid, due_at timestamptz, allow_late boolean, hand_in boolean, marks_released boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.group_id, a.due_at, a.allow_late, a.hand_in, a.marks_released
  from public.class_assignments a
  where a.id = aid;
$$;

revoke execute on function public.assignment_rules(uuid) from public, anon;
grant  execute on function public.assignment_rules(uuid) to authenticated, service_role;


-- Tell students when an assignment's date, brief or file changes
create or replace function public.notify_assignment_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.updated_at := now();

  if new.due_at is distinct from old.due_at
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.file_path is distinct from old.file_path then

    perform public.notify_class_students(
      new.group_id,
      'assignment_changed_' || new.id || '_' || extract(epoch from now())::bigint,
      'Updated: ' || new.title,
      public.class_label(new.group_id)
        || case
             when new.due_at is distinct from old.due_at and new.due_at is not null
             then ' · new due date ' || to_char(new.due_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon, HH12:MI AM')
             else ' · details changed'
           end,
      'assignment',
      '/classes/' || new.group_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_assignment_changed on public.class_assignments;

create trigger notify_assignment_changed
before update of due_at, title, description, file_path, file_name, points, hand_in, weight, allow_late
on public.class_assignments
for each row
execute function public.notify_assignment_changed();


-- No "due soon" reminder for items with nothing to hand in
create or replace function public.create_due_soon_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  made integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  select
    auth.uid(),
    'due_soon_' || a.id,
    'Due soon: ' || a.title,
    public.class_label(a.group_id)
      || ' · due '
      || to_char(a.due_at at time zone 'Asia/Kuala_Lumpur', 'Dy DD Mon, HH12:MI AM'),
    'assignment',
    '/classes/' || a.group_id,
    false
  from public.class_assignments a
  join public.course_group_members m
    on m.group_id = a.group_id
   and m.student_id = auth.uid()
   and m.status = 'active'
  where a.hand_in
    and a.due_at > now()
    and a.due_at <= now() + interval '24 hours'
    and not exists (
      select 1 from public.assignment_submissions s
      where s.assignment_id = a.id
        and s.student_id = auth.uid()
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = auth.uid()
        and n.notification_key = 'due_soon_' || a.id
    );

  get diagnostics made = row_count;
  return made;
end;
$$;


-- ------------------------------------------------------------
-- MARKS live in their own table so they can stay hidden from
-- students until the professor releases them.
-- ------------------------------------------------------------

create table if not exists public.assignment_marks (
  assignment_id uuid not null references public.class_assignments(id) on delete cascade,
  student_id    uuid not null references auth.users(id) on delete cascade,
  group_id      uuid not null references public.course_groups(id) on delete cascade,
  grade         numeric(6, 2),
  feedback      text check (feedback is null or length(feedback) <= 5000),
  graded_at     timestamptz not null default now(),
  graded_by     uuid references auth.users(id) on delete set null,
  primary key (assignment_id, student_id)
);

create index if not exists assignment_marks_group_idx
  on public.assignment_marks (group_id);

alter table public.assignment_marks enable row level security;
revoke insert, update, delete on public.assignment_marks from anon, authenticated;

-- Copy marks that were given before this update
insert into public.assignment_marks
  (assignment_id, student_id, group_id, grade, feedback, graded_at, graded_by)
select s.assignment_id, s.student_id, s.group_id, s.grade, s.feedback,
       coalesce(s.graded_at, now()), s.graded_by
from public.assignment_submissions s
where s.grade is not null or s.feedback is not null
on conflict (assignment_id, student_id) do nothing;


create or replace function public.marks_are_released(aid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select marks_released from public.class_assignments where id = aid), false);
$$;

create or replace function public.is_marked(aid uuid, sid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.assignment_marks
    where assignment_id = aid and student_id = sid
  );
$$;

revoke execute on function public.marks_are_released(uuid)  from public, anon;
revoke execute on function public.is_marked(uuid, uuid)      from public, anon;
grant  execute on function public.marks_are_released(uuid)  to authenticated, service_role;
grant  execute on function public.is_marked(uuid, uuid)      to authenticated, service_role;


drop policy if exists "Teachers see marks, students see released" on public.assignment_marks;

create policy "Teachers see marks, students see released"
on public.assignment_marks for select to authenticated
using (
  public.is_class_professor(group_id)
  or (student_id = auth.uid() and public.marks_are_released(assignment_id))
);


-- TEACHER: give (or clear) a mark + feedback.
-- Works with or without a hand-in (e.g. an exam mark).
create or replace function public.set_mark(
  input_assignment_id uuid,
  input_student_id    uuid,
  input_grade         numeric,
  input_feedback      text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a public.class_assignments;
begin
  select * into a from public.class_assignments where id = input_assignment_id;

  if a.id is null or not public.is_class_professor(a.group_id) then
    raise exception 'Only a teacher of this class can mark this.';
  end if;

  if not exists (
    select 1 from public.course_group_members m
    where m.group_id = a.group_id and m.student_id = input_student_id
  ) then
    raise exception 'That student is not in this class.';
  end if;

  if input_grade is not null
     and (input_grade < 0 or (a.points is not null and input_grade > a.points)) then
    raise exception 'The mark must be between 0 and %.', coalesce(a.points, 0);
  end if;

  if input_grade is null and nullif(trim(coalesce(input_feedback, '')), '') is null then
    delete from public.assignment_marks
    where assignment_id = input_assignment_id and student_id = input_student_id;
    return;
  end if;

  insert into public.assignment_marks
    (assignment_id, student_id, group_id, grade, feedback, graded_at, graded_by)
  values (
    input_assignment_id, input_student_id, a.group_id, input_grade,
    nullif(trim(coalesce(input_feedback, '')), ''), now(), auth.uid()
  )
  on conflict (assignment_id, student_id)
  do update set
    grade     = excluded.grade,
    feedback  = excluded.feedback,
    graded_at = now(),
    graded_by = auth.uid();
end;
$$;


-- TEACHER: release (or hide) marks for one assignment
create or replace function public.set_marks_released(
  input_assignment_id uuid,
  input_released      boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gid uuid;
begin
  select group_id into gid from public.class_assignments where id = input_assignment_id;

  if gid is null or not public.is_class_professor(gid) then
    raise exception 'Only a teacher of this class can release marks.';
  end if;

  update public.class_assignments
  set marks_released = coalesce(input_released, false)
  where id = input_assignment_id;
end;
$$;

revoke execute on function public.set_mark(uuid, uuid, numeric, text)   from public, anon;
revoke execute on function public.set_marks_released(uuid, boolean)     from public, anon;
grant  execute on function public.set_mark(uuid, uuid, numeric, text)   to authenticated, service_role;
grant  execute on function public.set_marks_released(uuid, boolean)     to authenticated, service_role;


-- Students hear about a mark only once it is released
drop trigger if exists notify_submission_marked on public.assignment_submissions;

create or replace function public.notify_mark_saved()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a public.class_assignments;
begin
  if new.grade is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.grade is not distinct from old.grade
     and new.feedback is not distinct from old.feedback then
    return new;
  end if;

  select * into a from public.class_assignments where id = new.assignment_id;

  if not coalesce(a.marks_released, false) then
    return new;
  end if;

  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  values (
    new.student_id,
    'marked_' || new.assignment_id || '_' || new.student_id || '_' || extract(epoch from now())::bigint,
    'Marked: ' || coalesce(a.title, 'your work'),
    'You got ' || trim(to_char(new.grade, 'FM999990.##'))
      || coalesce(' / ' || a.points::text, '')
      || ' · ' || coalesce(public.class_label(new.group_id), ''),
    'marked',
    '/classes/' || new.group_id || '?tab=grades',
    false
  );

  return new;
end;
$$;

drop trigger if exists notify_mark_saved on public.assignment_marks;

create trigger notify_mark_saved
after insert or update on public.assignment_marks
for each row
execute function public.notify_mark_saved();


create or replace function public.notify_marks_released()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.marks_released and not coalesce(old.marks_released, false) then
    insert into public.notifications
      (user_id, notification_key, title, message, category, link, is_read)
    select
      m.student_id,
      'released_' || new.id || '_' || m.student_id || '_' || extract(epoch from now())::bigint,
      'Marks released: ' || new.title,
      case
        when m.grade is not null
        then 'You got ' || trim(to_char(m.grade, 'FM999990.##'))
             || coalesce(' / ' || new.points::text, '') || ' · '
        else ''
      end || coalesce(public.class_label(new.group_id), ''),
      'marked',
      '/classes/' || new.group_id || '?tab=grades',
      false
    from public.assignment_marks m
    where m.assignment_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_marks_released on public.class_assignments;

create trigger notify_marks_released
after update of marks_released on public.class_assignments
for each row
execute function public.notify_marks_released();


-- Hand-in guard: "already marked" now checks the marks table,
-- and mark-only items (exams) have no hand-in.
create or replace function public.guard_assignment_submission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  rule record;
begin
  select * into rule from public.assignment_rules(new.assignment_id);

  if rule.group_id is null then
    raise exception 'This assignment no longer exists.';
  end if;

  new.group_id := rule.group_id;

  -- Dashboard / server: no restrictions
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.student_id = auth.uid() then

    if not coalesce(rule.hand_in, true) then
      raise exception 'Nothing to hand in for this item. Your professor enters the mark.';
    end if;

    if public.is_marked(new.assignment_id, auth.uid()) then
      raise exception 'This work has already been marked, so it can''t be changed.';
    end if;

    if tg_op = 'UPDATE' and new.assignment_id is distinct from old.assignment_id then
      raise exception 'You can''t move a submission to another assignment.';
    end if;

    if not coalesce(rule.allow_late, true)
       and rule.due_at is not null
       and now() > rule.due_at then
      raise exception 'The deadline has passed and your professor isn''t accepting late work for this assignment.';
    end if;

    new.grade        := null;
    new.feedback     := null;
    new.graded_at    := null;
    new.graded_by    := null;
    new.submitted_at := now();
    new.updated_at   := now();

    return new;
  end if;

  raise exception 'Marks are saved with the Mark box. Hand-ins can only be changed by the student.';
end;
$$;


drop policy if exists "Students can remove unmarked work" on public.assignment_submissions;

create policy "Students can remove unmarked work"
on public.assignment_submissions for delete to authenticated
using (
  student_id = auth.uid()
  and not public.is_marked(assignment_id, auth.uid())
  and exists (
    select 1
    from public.assignment_rules(assignment_id) a
    where a.allow_late or a.due_at is null or now() <= a.due_at
  )
);


-- ============================================================
-- 4. ABSENCE EXCUSES (MC)
-- ============================================================

create table if not exists public.attendance_excuses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.attendance_sessions(id) on delete cascade,
  group_id      uuid not null references public.course_groups(id) on delete cascade,
  student_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason        text not null check (length(trim(reason)) between 3 and 1000),
  file_path     text,
  file_name     text,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'rejected')),
  reviewer_note text check (reviewer_note is null or length(reviewer_note) <= 1000),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists attendance_excuses_group_idx
  on public.attendance_excuses (group_id, status);

alter table public.attendance_excuses enable row level security;


create or replace function public.session_group(sid uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select group_id from public.attendance_sessions where id = sid;
$$;

revoke execute on function public.session_group(uuid) from public, anon;
grant  execute on function public.session_group(uuid) to authenticated, service_role;


-- Students: only their reason/file while pending.
-- Teachers: only the decision + note.
create or replace function public.guard_attendance_excuse()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.group_id := public.session_group(new.session_id);

  if new.group_id is null then
    raise exception 'That class session no longer exists.';
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.student_id = auth.uid() then
    if tg_op = 'INSERT' and exists (
      select 1 from public.attendance_records r
      where r.session_id = new.session_id
        and r.student_id = auth.uid()
        and r.status in ('present', 'late')
    ) then
      raise exception 'You were marked present for this class, so there is nothing to excuse.';
    end if;

    if tg_op = 'UPDATE' then
      if old.status <> 'pending' then
        raise exception 'Your professor has already decided on this excuse.';
      end if;
      new.session_id := old.session_id;
      new.group_id   := old.group_id;
    end if;

    new.status        := 'pending';
    new.reviewer_note := null;
    new.reviewed_by   := null;
    new.reviewed_at   := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and public.is_class_professor(old.group_id) then
    new.session_id := old.session_id;
    new.group_id   := old.group_id;
    new.student_id := old.student_id;
    new.reason     := old.reason;
    new.file_path  := old.file_path;
    new.file_name  := old.file_name;
    new.created_at := old.created_at;
    new.reviewed_by := auth.uid();
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
    return new;
  end if;

  raise exception 'You can''t change this excuse.';
end;
$$;

drop trigger if exists guard_attendance_excuse on public.attendance_excuses;

create trigger guard_attendance_excuse
before insert or update on public.attendance_excuses
for each row
execute function public.guard_attendance_excuse();


drop policy if exists "Excuses: student or teacher can read"  on public.attendance_excuses;
drop policy if exists "Excuses: student sends"                on public.attendance_excuses;
drop policy if exists "Excuses: student or teacher updates"   on public.attendance_excuses;
drop policy if exists "Excuses: student withdraws pending"    on public.attendance_excuses;

create policy "Excuses: student or teacher can read"
on public.attendance_excuses for select to authenticated
using (student_id = auth.uid() or public.is_class_professor(group_id));

create policy "Excuses: student sends"
on public.attendance_excuses for insert to authenticated
with check (
  student_id = auth.uid()
  and public.is_class_student(public.session_group(session_id))
);

create policy "Excuses: student or teacher updates"
on public.attendance_excuses for update to authenticated
using (student_id = auth.uid() or public.is_class_professor(group_id))
with check (student_id = auth.uid() or public.is_class_professor(group_id));

create policy "Excuses: student withdraws pending"
on public.attendance_excuses for delete to authenticated
using (student_id = auth.uid() and status = 'pending');


create or replace function public.notify_attendance_excuse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  who text;
begin
  if tg_op = 'INSERT' then
    select full_name into who from public.profiles where id = new.student_id;

    perform public.notify_class_teachers(
      new.group_id,
      'excuse_' || new.id,
      'Absence excuse from ' || coalesce(who, 'a student'),
      public.class_label(new.group_id) || ' · ' || left(new.reason, 100),
      'excuse',
      '/professor/classes/' || new.group_id || '?tab=attendance'
    );
  elsif new.status <> old.status and new.status <> 'pending' then
    insert into public.notifications
      (user_id, notification_key, title, message, category, link, is_read)
    values (
      new.student_id,
      'excuse_decided_' || new.id || '_' || extract(epoch from now())::bigint,
      'Absence excuse ' || new.status,
      public.class_label(new.group_id) || coalesce(' · ' || new.reviewer_note, ''),
      'excuse',
      '/classes/' || new.group_id || '?tab=attendance',
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_attendance_excuse on public.attendance_excuses;

create trigger notify_attendance_excuse
after insert or update on public.attendance_excuses
for each row
execute function public.notify_attendance_excuse();


-- File store for MCs:  excuses/<class id>/<student id>/<file>
insert into storage.buckets (id, name, public, file_size_limit)
values ('excuses', 'excuses', false, 10485760)  -- 10 MB
on conflict (id) do nothing;

drop policy if exists "Excuses: owner or teacher read"   on storage.objects;
drop policy if exists "Excuses: student uploads"         on storage.objects;
drop policy if exists "Excuses: student deletes"         on storage.objects;

create policy "Excuses: owner or teacher read"
on storage.objects for select to authenticated
using (
  bucket_id = 'excuses'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.is_class_professor(public.try_uuid((storage.foldername(name))[1]))
  )
);

create policy "Excuses: student uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'excuses'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_class_student(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Excuses: student deletes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'excuses'
  and (storage.foldername(name))[2] = auth.uid()::text
);


-- ============================================================
-- 5. QUESTIONS & ANSWERS
-- ============================================================

create table if not exists public.course_questions (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.course_groups(id) on delete cascade,
  author_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null check (length(trim(title)) between 3 and 200),
  body         text check (body is null or length(body) <= 5000),
  is_resolved  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.course_answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.course_questions(id) on delete cascade,
  group_id     uuid not null references public.course_groups(id) on delete cascade,
  author_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body         text not null check (length(trim(body)) between 1 and 5000),
  created_at   timestamptz not null default now()
);

create index if not exists course_questions_group_idx on public.course_questions (group_id, created_at desc);
create index if not exists course_answers_question_idx on public.course_answers (question_id, created_at);

alter table public.course_questions enable row level security;
alter table public.course_answers   enable row level security;


create or replace function public.question_group(qid uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select group_id from public.course_questions where id = qid;
$$;

revoke execute on function public.question_group(uuid) from public, anon;
grant  execute on function public.question_group(uuid) to authenticated, service_role;


create or replace function public.guard_course_answer()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.group_id := public.question_group(new.question_id);
  if new.group_id is null then
    raise exception 'That question no longer exists.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_course_answer on public.course_answers;

create trigger guard_course_answer
before insert on public.course_answers
for each row
execute function public.guard_course_answer();


drop policy if exists "Q&A: class reads questions"        on public.course_questions;
drop policy if exists "Q&A: class asks"                   on public.course_questions;
drop policy if exists "Q&A: author or teacher updates"    on public.course_questions;
drop policy if exists "Q&A: author or teacher deletes"    on public.course_questions;
drop policy if exists "Q&A: class reads answers"          on public.course_answers;
drop policy if exists "Q&A: class answers"                on public.course_answers;
drop policy if exists "Q&A: author or teacher deletes answers" on public.course_answers;

create policy "Q&A: class reads questions"
on public.course_questions for select to authenticated
using (public.is_class_professor(group_id) or public.is_class_student(group_id));

create policy "Q&A: class asks"
on public.course_questions for insert to authenticated
with check (
  author_id = auth.uid()
  and (public.is_class_professor(group_id) or public.is_class_student(group_id))
);

create policy "Q&A: author or teacher updates"
on public.course_questions for update to authenticated
using (author_id = auth.uid() or public.is_class_professor(group_id))
with check (author_id = auth.uid() or public.is_class_professor(group_id));

create policy "Q&A: author or teacher deletes"
on public.course_questions for delete to authenticated
using (author_id = auth.uid() or public.is_class_professor(group_id));

create policy "Q&A: class reads answers"
on public.course_answers for select to authenticated
using (public.is_class_professor(group_id) or public.is_class_student(group_id));

create policy "Q&A: class answers"
on public.course_answers for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_class_professor(public.question_group(question_id))
    or public.is_class_student(public.question_group(question_id))
  )
);

create policy "Q&A: author or teacher deletes answers"
on public.course_answers for delete to authenticated
using (author_id = auth.uid() or public.is_class_professor(group_id));


create or replace function public.notify_course_question()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  who text;
begin
  select full_name into who from public.profiles where id = new.author_id;

  perform public.notify_class_teachers(
    new.group_id,
    'question_' || new.id,
    'New question: ' || new.title,
    coalesce(who, 'A student') || ' · ' || public.class_label(new.group_id),
    'question',
    '/professor/classes/' || new.group_id || '?tab=qa',
    new.author_id
  );

  return new;
end;
$$;

drop trigger if exists notify_course_question on public.course_questions;

create trigger notify_course_question
after insert on public.course_questions
for each row
execute function public.notify_course_question();


create or replace function public.notify_course_answer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  q   public.course_questions;
  who text;
  asker_teaches boolean;
begin
  select * into q from public.course_questions where id = new.question_id;
  select full_name into who from public.profiles where id = new.author_id;

  if q.author_id is not null and q.author_id <> new.author_id then
    select exists (
      select 1 from public.course_groups where id = q.group_id and professor_id = q.author_id
      union all
      select 1 from public.course_group_teachers where group_id = q.group_id and teacher_id = q.author_id
    ) into asker_teaches;

    insert into public.notifications
      (user_id, notification_key, title, message, category, link, is_read)
    values (
      q.author_id,
      'answer_' || new.id,
      coalesce(who, 'Someone') || ' answered your question',
      q.title || ' · ' || public.class_label(q.group_id),
      'question',
      case when asker_teaches then '/professor/classes/' else '/classes/' end || q.group_id || '?tab=qa',
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_course_answer on public.course_answers;

create trigger notify_course_answer
after insert on public.course_answers
for each row
execute function public.notify_course_answer();


-- ============================================================
-- 6. CLASS TIMETABLE
-- ============================================================

create table if not exists public.class_meetings (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.course_groups(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 1 and 7),  -- 1 = Monday
  starts_at    time not null,
  ends_at      time not null,
  room         text check (room is null or length(room) <= 100),
  kind         text not null default 'Lecture'
               check (kind in ('Lecture', 'Tutorial', 'Lab', 'Other')),
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists class_meetings_group_idx on public.class_meetings (group_id);

alter table public.class_meetings enable row level security;

drop policy if exists "Timetable: class reads"       on public.class_meetings;
drop policy if exists "Timetable: teachers add"      on public.class_meetings;
drop policy if exists "Timetable: teachers change"   on public.class_meetings;
drop policy if exists "Timetable: teachers remove"   on public.class_meetings;

create policy "Timetable: class reads"
on public.class_meetings for select to authenticated
using (public.is_class_professor(group_id) or public.is_class_student(group_id));

create policy "Timetable: teachers add"
on public.class_meetings for insert to authenticated
with check (public.is_class_professor(group_id));

create policy "Timetable: teachers change"
on public.class_meetings for update to authenticated
using (public.is_class_professor(group_id))
with check (public.is_class_professor(group_id));

create policy "Timetable: teachers remove"
on public.class_meetings for delete to authenticated
using (public.is_class_professor(group_id));


-- ============================================================
-- 7. QUIZZES (multiple choice, marked automatically)
-- Students never see the correct answers until the quiz closes.
-- ============================================================

create table if not exists public.quizzes (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references public.course_groups(id) on delete cascade,
  created_by          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title               text not null check (length(trim(title)) between 1 and 200),
  instructions        text check (instructions is null or length(instructions) <= 3000),
  opens_at            timestamptz,
  closes_at           timestamptz,
  time_limit_minutes  integer check (time_limit_minutes is null or time_limit_minutes between 1 and 300),
  weight              numeric(5, 2) check (weight is null or (weight >= 0 and weight <= 100)),
  is_published        boolean not null default false,
  created_at          timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table if not exists public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  position       integer not null default 1,
  prompt         text not null check (length(trim(prompt)) between 1 and 2000),
  options        text[] not null check (array_length(options, 1) between 2 and 6),
  correct_index  integer not null check (correct_index >= 0),
  points         numeric(5, 2) not null default 1 check (points > 0),
  check (correct_index < array_length(options, 1))
);

create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  group_id      uuid not null references public.course_groups(id) on delete cascade,
  student_id    uuid not null references auth.users(id) on delete cascade,
  started_at    timestamptz not null default now(),
  deadline      timestamptz,
  submitted_at  timestamptz,
  answers       integer[],
  score         numeric(7, 2),
  max_score     numeric(7, 2),
  unique (quiz_id, student_id)
);

create index if not exists quizzes_group_idx on public.quizzes (group_id);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;


create or replace function public.quiz_group(qid uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select group_id from public.quizzes where id = qid;
$$;

revoke execute on function public.quiz_group(uuid) from public, anon;
grant  execute on function public.quiz_group(uuid) to authenticated, service_role;


drop policy if exists "Quizzes: teachers all, students published" on public.quizzes;
drop policy if exists "Quizzes: teachers add"                      on public.quizzes;
drop policy if exists "Quizzes: teachers change"                   on public.quizzes;
drop policy if exists "Quizzes: teachers remove"                   on public.quizzes;
drop policy if exists "Quiz questions: teachers only"              on public.quiz_questions;
drop policy if exists "Quiz attempts: own or teacher"              on public.quiz_attempts;

create policy "Quizzes: teachers all, students published"
on public.quizzes for select to authenticated
using (
  public.is_class_professor(group_id)
  or (is_published and public.is_class_student(group_id))
);

create policy "Quizzes: teachers add"
on public.quizzes for insert to authenticated
with check (public.is_class_professor(group_id) and created_by = auth.uid());

create policy "Quizzes: teachers change"
on public.quizzes for update to authenticated
using (public.is_class_professor(group_id))
with check (public.is_class_professor(group_id));

create policy "Quizzes: teachers remove"
on public.quizzes for delete to authenticated
using (public.is_class_professor(group_id));

-- Students never read this table (it holds the answers)
create policy "Quiz questions: teachers only"
on public.quiz_questions for all to authenticated
using (public.is_class_professor(public.quiz_group(quiz_id)))
with check (public.is_class_professor(public.quiz_group(quiz_id)));

create policy "Quiz attempts: own or teacher"
on public.quiz_attempts for select to authenticated
using (student_id = auth.uid() or public.is_class_professor(group_id));


-- Teachers can't change questions once students have started
create or replace function public.guard_quiz_questions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  qid uuid := case when tg_op = 'DELETE' then old.quiz_id else new.quiz_id end;
begin
  -- Deleting the whole quiz is fine
  if tg_op = 'DELETE' and not exists (select 1 from public.quizzes where id = qid) then
    return old;
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = qid) then
    raise exception 'Students have already started this quiz, so its questions can''t be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_quiz_questions on public.quiz_questions;

create trigger guard_quiz_questions
before insert or update or delete on public.quiz_questions
for each row
execute function public.guard_quiz_questions();


-- STUDENT: start (or continue) a quiz. Returns the questions
-- WITHOUT the answers, plus when it must be handed in.
create or replace function public.start_quiz(input_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  q       public.quizzes;
  att     public.quiz_attempts;
  limit_at timestamptz;
begin
  select * into q from public.quizzes where id = input_quiz_id;

  if q.id is null or not q.is_published or not public.is_class_student(q.group_id) then
    raise exception 'This quiz isn''t available to you.';
  end if;

  select * into att from public.quiz_attempts
  where quiz_id = q.id and student_id = auth.uid();

  if att.id is null then
    if q.opens_at is not null and now() < q.opens_at then
      raise exception 'This quiz opens on %.', to_char(q.opens_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon, HH12:MI AM');
    end if;

    if q.closes_at is not null and now() > q.closes_at then
      raise exception 'This quiz has closed.';
    end if;

    if not exists (select 1 from public.quiz_questions where quiz_id = q.id) then
      raise exception 'This quiz has no questions yet.';
    end if;

    limit_at := case
                  when q.time_limit_minutes is not null
                  then now() + make_interval(mins => q.time_limit_minutes)
                end;

    insert into public.quiz_attempts (quiz_id, group_id, student_id, deadline, max_score)
    values (
      q.id, q.group_id, auth.uid(),
      case
        when limit_at is null then q.closes_at
        when q.closes_at is null then limit_at
        else least(limit_at, q.closes_at)
      end,
      (select sum(points) from public.quiz_questions where quiz_id = q.id)
    )
    returning * into att;
  end if;

  if att.submitted_at is not null then
    raise exception 'You have already handed in this quiz.';
  end if;

  return jsonb_build_object(
    'attempt_id', att.id,
    'started_at', att.started_at,
    'deadline',   att.deadline,
    'questions',  coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'prompt', qq.prompt,
          'options', to_jsonb(qq.options),
          'points', qq.points
        ) order by qq.position, qq.id
      )
      from public.quiz_questions qq
      where qq.quiz_id = q.id
    ), '[]'::jsonb)
  );
end;
$$;


-- STUDENT: hand in. answers[i] = chosen option for question i
-- (in the order start_quiz returned them), -1 = no answer.
create or replace function public.submit_quiz(input_quiz_id uuid, input_answers integer[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  att    public.quiz_attempts;
  total  numeric := 0;
  maxs   numeric := 0;
  i      integer := 0;
  qq     record;
  picked integer;
begin
  select * into att from public.quiz_attempts
  where quiz_id = input_quiz_id and student_id = auth.uid();

  if att.id is null then
    raise exception 'Start the quiz first.';
  end if;

  if att.submitted_at is not null then
    raise exception 'You have already handed in this quiz.';
  end if;

  -- 2 minutes grace for slow connections
  if att.deadline is not null and now() > att.deadline + interval '2 minutes' then
    raise exception 'Time is up. This quiz can no longer be handed in.';
  end if;

  for qq in
    select id, correct_index, points
    from public.quiz_questions
    where quiz_id = input_quiz_id
    order by position, id
  loop
    i := i + 1;
    picked := coalesce(input_answers[i], -1);
    maxs := maxs + qq.points;
    if picked = qq.correct_index then
      total := total + qq.points;
    end if;
  end loop;

  update public.quiz_attempts
  set submitted_at = now(),
      answers      = coalesce(input_answers, '{}'),
      score        = total,
      max_score    = maxs
  where id = att.id;

  return jsonb_build_object('score', total, 'max_score', maxs);
end;
$$;


-- STUDENT: review answers once the quiz has closed
-- (or straight away when the quiz has no closing time).
create or replace function public.review_quiz(input_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  q   public.quizzes;
  att public.quiz_attempts;
begin
  select * into q from public.quizzes where id = input_quiz_id;
  select * into att from public.quiz_attempts
  where quiz_id = input_quiz_id and student_id = auth.uid();

  if q.id is null or att.submitted_at is null then
    raise exception 'Hand in the quiz first.';
  end if;

  if q.closes_at is not null and now() < q.closes_at then
    raise exception 'Answers are shown after the quiz closes on %.',
      to_char(q.closes_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon, HH12:MI AM');
  end if;

  return jsonb_build_object(
    'score', att.score,
    'max_score', att.max_score,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'prompt', x.prompt,
          'options', to_jsonb(x.options),
          'correct_index', x.correct_index,
          'points', x.points,
          'picked', coalesce(att.answers[x.n], -1)
        ) order by x.n
      )
      from (
        select qq.*, row_number() over (order by qq.position, qq.id)::int as n
        from public.quiz_questions qq
        where qq.quiz_id = input_quiz_id
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.start_quiz(uuid)              from public, anon;
revoke execute on function public.submit_quiz(uuid, integer[])  from public, anon;
revoke execute on function public.review_quiz(uuid)             from public, anon;
grant  execute on function public.start_quiz(uuid)              to authenticated, service_role;
grant  execute on function public.submit_quiz(uuid, integer[])  to authenticated, service_role;
grant  execute on function public.review_quiz(uuid)             to authenticated, service_role;


create or replace function public.notify_quiz_published()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not coalesce(old.is_published, false)) then
    perform public.notify_class_students(
      new.group_id,
      'quiz_' || new.id,
      'New quiz: ' || new.title,
      public.class_label(new.group_id)
        || case
             when new.closes_at is not null
             then ' · closes ' || to_char(new.closes_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon, HH12:MI AM')
             else ''
           end,
      'quiz',
      '/classes/' || new.group_id || '?tab=quizzes'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_quiz_published on public.quizzes;

create trigger notify_quiz_published
after insert or update of is_published on public.quizzes
for each row
execute function public.notify_quiz_published();


-- ============================================================
-- 8. SEARCH ACROSS YOUR CLASSES
-- ============================================================

create or replace function public.search_campusmate(input_query text)
returns table (
  kind        text,
  item_id     uuid,
  group_id    uuid,
  class_label text,
  title       text,
  snippet     text,
  created_at  timestamptz,
  link        text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  q       text := trim(coalesce(input_query, ''));
  pattern text;
begin
  if auth.uid() is null or length(q) < 2 then
    return;
  end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with mine as (
    select g.id, g.name, g.course_code,
           public.is_class_professor(g.id) as teaches
    from public.course_groups g
    where public.is_class_professor(g.id) or public.is_class_student(g.id)
  ),
  hits as (
    select 'class'::text as kind, m.id as item_id, m.id as group_id,
           m.name::text as title, null::text as snippet, null::timestamptz as created_at
    from mine m
    where m.name ilike pattern or m.course_code ilike pattern

    union all
    select p.kind, p.id, p.group_id, p.title,
           coalesce(p.file_name, left(p.body, 160)), p.created_at
    from public.course_posts p
    join mine m on m.id = p.group_id
    where p.title ilike pattern or p.body ilike pattern or p.file_name ilike pattern

    union all
    select 'assignment', a.id, a.group_id, a.title,
           coalesce(a.file_name, left(a.description, 160)), a.created_at
    from public.class_assignments a
    join mine m on m.id = a.group_id
    where a.title ilike pattern or a.description ilike pattern or a.file_name ilike pattern

    union all
    select 'question', cq.id, cq.group_id, cq.title, left(cq.body, 160), cq.created_at
    from public.course_questions cq
    join mine m on m.id = cq.group_id
    where cq.title ilike pattern or cq.body ilike pattern

    union all
    select 'quiz', z.id, z.group_id, z.title, left(z.instructions, 160), z.created_at
    from public.quizzes z
    join mine m on m.id = z.group_id
    where (z.is_published or m.teaches)
      and (z.title ilike pattern or z.instructions ilike pattern)
  )
  select h.kind, h.item_id, h.group_id,
         coalesce(nullif(trim(m.course_code), ''), m.name)::text,
         h.title, h.snippet, h.created_at,
         case when m.teaches then '/professor/classes/' else '/classes/' end || h.group_id
  from hits h
  join mine m on m.id = h.group_id
  order by (h.kind = 'class') desc, h.created_at desc nulls last
  limit 60;
end;
$$;

revoke execute on function public.search_campusmate(text) from public, anon;
grant  execute on function public.search_campusmate(text) to authenticated, service_role;


-- ============================================================
-- CHECK: every line should say ok
-- ============================================================

select item, case when found then 'ok' else 'MISSING' end as status
from (
  values
    ('teachers table',   to_regclass('public.course_group_teachers') is not null),
    ('marks table',      to_regclass('public.assignment_marks') is not null),
    ('excuses table',    to_regclass('public.attendance_excuses') is not null),
    ('Q&A tables',       to_regclass('public.course_answers') is not null),
    ('timetable table',  to_regclass('public.class_meetings') is not null),
    ('quiz tables',      to_regclass('public.quiz_attempts') is not null),
    ('bulk add',         exists (select 1 from pg_proc where proname = 'add_students_to_class')),
    ('search',           exists (select 1 from pg_proc where proname = 'search_campusmate')),
    ('assignment files', exists (select 1 from information_schema.columns
                                 where table_name = 'class_assignments' and column_name = 'file_path'))
) as t(item, found);
