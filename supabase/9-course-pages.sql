-- ============================================================
-- CampusMate: course pages (like USM eLearning)
--
-- Adds:
--   1. course_posts            announcements + course materials
--   2. assignment_submissions  students hand in work, professors
--                              give a mark and feedback
--   3. class_participants()    everyone in a class (for the
--                              Participants tab)
--   4. Two private file stores: course-files, submissions
--
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- HELPERS
-- ------------------------------------------------------------

-- Is the logged-in user the professor of this class?
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
  );
$$;

-- Is the logged-in user an active student in this class?
create or replace function public.is_class_student(gid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.course_group_members
    where group_id = gid
      and student_id = auth.uid()
      and status = 'active'
  );
$$;

-- Turns text into a uuid, or null if it isn't one
-- (used to read class ids from file paths safely).
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.is_class_professor(uuid) from public, anon;
revoke execute on function public.is_class_student(uuid)   from public, anon;
grant  execute on function public.is_class_professor(uuid) to authenticated, service_role;
grant  execute on function public.is_class_student(uuid)   to authenticated, service_role;
grant  execute on function public.try_uuid(text)           to authenticated, service_role;


-- ------------------------------------------------------------
-- 1. ANNOUNCEMENTS + COURSE MATERIALS
-- ------------------------------------------------------------

create table if not exists public.course_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.course_groups(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('announcement', 'material')),
  title       text not null check (length(trim(title)) between 1 and 200),
  body        text check (body is null or length(body) <= 5000),
  link_url    text check (link_url is null or link_url ~* '^https?://'),
  file_path   text,
  file_name   text,
  created_at  timestamptz not null default now()
);

create index if not exists course_posts_group_idx
  on public.course_posts (group_id, created_at desc);

alter table public.course_posts enable row level security;

drop policy if exists "Class members can read posts"   on public.course_posts;
drop policy if exists "Professor can add posts"        on public.course_posts;
drop policy if exists "Professor can edit posts"       on public.course_posts;
drop policy if exists "Professor can delete posts"     on public.course_posts;

create policy "Class members can read posts"
on public.course_posts for select to authenticated
using (public.is_class_professor(group_id) or public.is_class_student(group_id));

create policy "Professor can add posts"
on public.course_posts for insert to authenticated
with check (public.is_class_professor(group_id) and author_id = auth.uid());

create policy "Professor can edit posts"
on public.course_posts for update to authenticated
using (public.is_class_professor(group_id))
with check (public.is_class_professor(group_id));

create policy "Professor can delete posts"
on public.course_posts for delete to authenticated
using (public.is_class_professor(group_id));


-- ------------------------------------------------------------
-- 2. ASSIGNMENT SUBMISSIONS
-- ------------------------------------------------------------

create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.class_assignments(id) on delete cascade,
  group_id      uuid not null references public.course_groups(id) on delete cascade,
  student_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  comment       text check (comment is null or length(comment) <= 2000),
  file_path     text,
  file_name     text,
  file_size     bigint,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  grade         numeric(6, 2),
  feedback      text check (feedback is null or length(feedback) <= 5000),
  graded_at     timestamptz,
  graded_by     uuid references auth.users(id) on delete set null,
  unique (assignment_id, student_id)
);

create index if not exists assignment_submissions_group_idx
  on public.assignment_submissions (group_id);

alter table public.assignment_submissions enable row level security;


-- Class + maximum mark of an assignment (reads past RLS).
create or replace function public.assignment_class_and_points(aid uuid)
returns table (group_id uuid, points numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.group_id, a.points::numeric
  from public.class_assignments a
  where a.id = aid;
$$;

revoke execute on function public.assignment_class_and_points(uuid) from public, anon;
grant  execute on function public.assignment_class_and_points(uuid) to authenticated, service_role;


-- Keeps each side to its own fields:
--   students: their file + comment, only until it's graded
--   professor: only the mark + feedback
-- (Not "security definer", so it can tell who is calling.)
create or replace function public.guard_assignment_submission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  the_group  uuid;
  max_points numeric;
begin

  select i.group_id, i.points
  into the_group, max_points
  from public.assignment_class_and_points(new.assignment_id) i;

  if the_group is null then
    raise exception 'This assignment no longer exists.';
  end if;

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

    -- Everything the student handed in stays as it was
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

drop trigger if exists guard_assignment_submission on public.assignment_submissions;

create trigger guard_assignment_submission
before insert or update on public.assignment_submissions
for each row
execute function public.guard_assignment_submission();


drop policy if exists "Students see own, professor sees class" on public.assignment_submissions;
drop policy if exists "Students hand in to their classes"       on public.assignment_submissions;
drop policy if exists "Student or professor can update"         on public.assignment_submissions;
drop policy if exists "Students can remove unmarked work"       on public.assignment_submissions;

create policy "Students see own, professor sees class"
on public.assignment_submissions for select to authenticated
using (student_id = auth.uid() or public.is_class_professor(group_id));

create policy "Students hand in to their classes"
on public.assignment_submissions for insert to authenticated
with check (student_id = auth.uid() and public.is_class_student(group_id));

create policy "Student or professor can update"
on public.assignment_submissions for update to authenticated
using (student_id = auth.uid() or public.is_class_professor(group_id))
with check (student_id = auth.uid() or public.is_class_professor(group_id));

create policy "Students can remove unmarked work"
on public.assignment_submissions for delete to authenticated
using (student_id = auth.uid() and grade is null);


-- ------------------------------------------------------------
-- 3. PARTICIPANTS (professor + students of one class)
-- ------------------------------------------------------------

create or replace function public.class_participants(gid uuid)
returns table (
  id          uuid,
  full_name   text,
  campus_id   text,
  programme   text,
  avatar_path text,
  role        text,
  joined_at   timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.campus_id, p.programme, p.avatar_path,
         'professor'::text, g.created_at
  from public.course_groups g
  join public.profiles p on p.id = g.professor_id
  where g.id = gid
    and (public.is_class_professor(gid) or public.is_class_student(gid))

  union all

  select p.id, p.full_name, p.campus_id, p.programme, p.avatar_path,
         'student'::text, m.joined_at
  from public.course_group_members m
  join public.profiles p on p.id = m.student_id
  where m.group_id = gid
    and m.status = 'active'
    and (public.is_class_professor(gid) or public.is_class_student(gid));
$$;

revoke execute on function public.class_participants(uuid) from public, anon;
grant  execute on function public.class_participants(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. FILE STORES
--   course-files : <class id>/<file>           (professor uploads)
--   submissions  : <class id>/<assignment id>/<student id>/<file>
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('course-files', 'course-files', false, 52428800),  -- 50 MB
  ('submissions',  'submissions',  false, 26214400)   -- 25 MB
on conflict (id) do nothing;

drop policy if exists "Course files: class can read"        on storage.objects;
drop policy if exists "Course files: professor uploads"     on storage.objects;
drop policy if exists "Course files: professor deletes"     on storage.objects;
drop policy if exists "Submissions: owner or professor read" on storage.objects;
drop policy if exists "Submissions: student uploads"        on storage.objects;
drop policy if exists "Submissions: student replaces"       on storage.objects;
drop policy if exists "Submissions: student deletes"        on storage.objects;

create policy "Course files: class can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-files'
  and (
    public.is_class_professor(public.try_uuid((storage.foldername(name))[1]))
    or public.is_class_student(public.try_uuid((storage.foldername(name))[1]))
  )
);

create policy "Course files: professor uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-files'
  and public.is_class_professor(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Course files: professor deletes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-files'
  and public.is_class_professor(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Submissions: owner or professor read"
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[3] = auth.uid()::text
    or public.is_class_professor(public.try_uuid((storage.foldername(name))[1]))
  )
);

create policy "Submissions: student uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.is_class_student(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Submissions: student replaces"
on storage.objects for update to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "Submissions: student deletes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[3] = auth.uid()::text
);


-- ------------------------------------------------------------
-- CHECK: should list the 2 new tables and 2 file stores
-- ------------------------------------------------------------

select 'table' as kind, table_name::text as name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('course_posts', 'assignment_submissions')

union all

select 'file store', id
from storage.buckets
where id in ('course-files', 'submissions');
