-- ============================================================
-- CampusMate: late hand-in rule, "due tomorrow" reminders,
-- hand-in alerts for professors
--
--   1. Each assignment has "allow late hand-ins" (on by default).
--      When it's off, students can't hand in after the deadline.
--   2. Students get a "Due tomorrow" notification for work they
--      haven't handed in (made when they open CampusMate).
--   3. Professors get a notification when a student hands in.
--
-- Run AFTER 12-notifications.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. LATE HAND-IN RULE
-- ------------------------------------------------------------

alter table public.class_assignments
  add column if not exists allow_late boolean not null default true;


-- Professor turns late hand-ins on/off for one assignment
create or replace function public.set_assignment_allow_late(
  input_assignment_id uuid,
  input_allow_late    boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gid uuid;
begin
  select group_id into gid
  from public.class_assignments
  where id = input_assignment_id;

  if gid is null or not public.is_class_professor(gid) then
    raise exception 'Only this class''s professor can change this.';
  end if;

  update public.class_assignments
  set allow_late = input_allow_late
  where id = input_assignment_id;
end;
$$;

revoke execute on function public.set_assignment_allow_late(uuid, boolean) from public, anon;
grant  execute on function public.set_assignment_allow_late(uuid, boolean) to authenticated, service_role;


-- Same guard as before, plus: no hand-ins after the deadline
-- when late work isn't allowed.
create or replace function public.guard_assignment_submission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  the_group  uuid;
  max_points numeric;
  the_due    timestamptz;
  late_ok    boolean;
begin

  select i.group_id, i.points
  into the_group, max_points
  from public.assignment_class_and_points(new.assignment_id) i;

  if the_group is null then
    raise exception 'This assignment no longer exists.';
  end if;

  select a.due_at, a.allow_late
  into the_due, late_ok
  from public.assignment_due_and_late(new.assignment_id) a;

  new.group_id := the_group;

  -- Dashboard / server: no restrictions
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- ---------- Student ----------
  if new.student_id = auth.uid() then

    if tg_op = 'UPDATE' then
      if old.grade is not null then
        raise exception 'This work has already been marked, so it can''t be changed.';
      end if;

      if new.assignment_id is distinct from old.assignment_id then
        raise exception 'You can''t move a submission to another assignment.';
      end if;
    end if;

    if not coalesce(late_ok, true)
       and the_due is not null
       and now() > the_due then
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

  -- ---------- Professor (marking) ----------
  if tg_op = 'UPDATE' and public.is_class_professor(the_group) then

    if new.grade is not null then
      if new.grade < 0 or (max_points is not null and new.grade > max_points) then
        raise exception 'The mark must be between 0 and %.', coalesce(max_points, 0);
      end if;
    end if;

    new.assignment_id := old.assignment_id;
    new.group_id      := old.group_id;
    new.student_id    := old.student_id;
    new.comment       := old.comment;
    new.file_path     := old.file_path;
    new.file_name     := old.file_name;
    new.file_size     := old.file_size;
    new.submitted_at  := old.submitted_at;
    new.updated_at    := old.updated_at;

    new.graded_at := case when new.grade is null and new.feedback is null then null else now() end;
    new.graded_by := auth.uid();

    return new;
  end if;

  raise exception 'You can''t change this submission.';

end;
$$;


-- Deadline + late rule of an assignment (reads past RLS)
create or replace function public.assignment_due_and_late(aid uuid)
returns table (due_at timestamptz, allow_late boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.due_at, a.allow_late
  from public.class_assignments a
  where a.id = aid;
$$;

revoke execute on function public.assignment_due_and_late(uuid) from public, anon;
grant  execute on function public.assignment_due_and_late(uuid) to authenticated, service_role;


-- Students also can't delete (= "un-hand-in") after a closed deadline
drop policy if exists "Students can remove unmarked work" on public.assignment_submissions;

create policy "Students can remove unmarked work"
on public.assignment_submissions for delete to authenticated
using (
  student_id = auth.uid()
  and grade is null
  and exists (
    select 1
    from public.assignment_due_and_late(assignment_id) a
    where a.allow_late or a.due_at is null or now() <= a.due_at
  )
);


-- ------------------------------------------------------------
-- 2. "DUE TOMORROW" REMINDERS
-- Called by the app when a student opens CampusMate. Makes at
-- most one reminder per assignment.
-- ------------------------------------------------------------

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
  where a.due_at > now()
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

revoke execute on function public.create_due_soon_reminders() from public, anon;
grant  execute on function public.create_due_soon_reminders() to authenticated, service_role;


-- ------------------------------------------------------------
-- 3. PROFESSOR: a student handed in
-- ------------------------------------------------------------

create or replace function public.notify_professor_hand_in()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a        public.class_assignments;
  prof     uuid;
  who      text;
begin
  select * into a
  from public.class_assignments
  where id = new.assignment_id;

  select professor_id into prof
  from public.course_groups
  where id = new.group_id;

  select full_name into who
  from public.profiles
  where id = new.student_id;

  if prof is null then
    return new;
  end if;

  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  values (
    prof,
    'handed_in_' || new.id || '_' || extract(epoch from now())::bigint,
    coalesce(who, 'A student') || ' handed in ' || coalesce(a.title, 'work'),
    public.class_label(new.group_id)
      || case
           when a.due_at is not null and new.submitted_at > a.due_at
           then ' · late'
           else ''
         end,
    'assignment',
    '/professor/classes/' || new.group_id,
    false
  );

  return new;
end;
$$;

drop trigger if exists notify_professor_hand_in on public.assignment_submissions;

create trigger notify_professor_hand_in
after insert on public.assignment_submissions
for each row
execute function public.notify_professor_hand_in();


-- CHECK
select 'column allow_late' as item,
       count(*)::text as ok
from information_schema.columns
where table_schema = 'public'
  and table_name = 'class_assignments'
  and column_name = 'allow_late'
union all
select 'functions',
       count(*)::text
from pg_proc
where proname in ('set_assignment_allow_late', 'create_due_soon_reminders', 'notify_professor_hand_in');
