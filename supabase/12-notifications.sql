-- ============================================================
-- CampusMate: automatic notifications
--
-- Students get a notification (bell + Notifications page) when:
--   * a professor posts a new assignment in one of their classes
--   * a professor posts an announcement or course material
--   * their work is marked
--
-- Run AFTER 9-course-pages.sql.
-- Run in: Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Notifications table: add a link, allow the new types
-- ------------------------------------------------------------

alter table public.notifications
  add column if not exists link text;

-- Remove any old rule that only allowed a fixed list of types,
-- then allow the old ones plus the new ones.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.notifications
  add constraint notifications_category_check
  check (
    category is null
    or category in (
      'assignment', 'project', 'attendance',
      'announcement', 'material', 'marked', 'general'
    )
  )
  not valid;

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);


-- Everyone can read and mark their OWN notifications.
-- (Extra policies only add access to your own rows.)
alter table public.notifications enable row level security;

drop policy if exists "CampusMate: read own notifications"   on public.notifications;
drop policy if exists "CampusMate: update own notifications" on public.notifications;
drop policy if exists "CampusMate: delete own notifications" on public.notifications;

create policy "CampusMate: read own notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy "CampusMate: update own notifications"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "CampusMate: delete own notifications"
on public.notifications for delete to authenticated
using (user_id = auth.uid());


-- ------------------------------------------------------------
-- 2. Helper: notify every active student in a class
-- ------------------------------------------------------------

create or replace function public.notify_class_students(
  gid       uuid,
  the_key   text,
  the_title text,
  the_msg   text,
  the_cat   text,
  the_link  text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  select
    m.student_id, the_key, the_title, the_msg, the_cat, the_link, false
  from public.course_group_members m
  where m.group_id = gid
    and m.status = 'active'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.student_id
        and n.notification_key = the_key
    );
end;
$$;

revoke execute on function public.notify_class_students(uuid, text, text, text, text, text)
  from public, anon, authenticated;


-- Short course label, e.g. "CPT113" or the class name
create or replace function public.class_label(gid uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(nullif(trim(course_code), ''), name)
  from public.course_groups
  where id = gid;
$$;


-- ------------------------------------------------------------
-- 3. New assignment -> students of that class
-- ------------------------------------------------------------

create or replace function public.notify_new_class_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.notify_class_students(
    new.group_id,
    'class_assignment_' || new.id,
    'New assignment: ' || new.title,
    public.class_label(new.group_id)
      || case
           when new.due_at is not null
           then ' · due ' || to_char(new.due_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon, HH12:MI AM')
           else ''
         end,
    'assignment',
    '/classes/' || new.group_id
  );
  return new;
end;
$$;

drop trigger if exists notify_new_class_assignment on public.class_assignments;

create trigger notify_new_class_assignment
after insert on public.class_assignments
for each row
execute function public.notify_new_class_assignment();


-- ------------------------------------------------------------
-- 4. New announcement / material -> students of that class
-- ------------------------------------------------------------

create or replace function public.notify_new_course_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.notify_class_students(
    new.group_id,
    'course_post_' || new.id,
    case
      when new.kind = 'announcement'
      then 'Announcement: ' || new.title
      else 'New material: ' || new.title
    end,
    public.class_label(new.group_id)
      || coalesce(' · ' || left(new.body, 120), ''),
    case when new.kind = 'announcement' then 'announcement' else 'material' end,
    '/classes/' || new.group_id
  );
  return new;
end;
$$;

drop trigger if exists notify_new_course_post on public.course_posts;

create trigger notify_new_course_post
after insert on public.course_posts
for each row
execute function public.notify_new_course_post();


-- ------------------------------------------------------------
-- 5. Work marked -> that student
-- ------------------------------------------------------------

create or replace function public.notify_submission_marked()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a public.class_assignments;
begin
  if new.grade is null or new.grade is not distinct from old.grade then
    return new;
  end if;

  select * into a
  from public.class_assignments
  where id = new.assignment_id;

  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  values (
    new.student_id,
    'marked_' || new.id || '_' || extract(epoch from now())::bigint,
    'Marked: ' || coalesce(a.title, 'your assignment'),
    'You got ' || trim(to_char(new.grade, 'FM999990.##'))
      || coalesce(' / ' || a.points::text, '')
      || ' · ' || coalesce(public.class_label(new.group_id), ''),
    'marked',
    '/classes/' || new.group_id,
    false
  );

  return new;
end;
$$;

drop trigger if exists notify_submission_marked on public.assignment_submissions;

create trigger notify_submission_marked
after update on public.assignment_submissions
for each row
execute function public.notify_submission_marked();


-- ------------------------------------------------------------
-- CHECK: should list the 3 new triggers
-- ------------------------------------------------------------

select tgname::text as trigger_name, tgrelid::regclass::text as on_table
from pg_trigger
where tgname in (
  'notify_new_class_assignment',
  'notify_new_course_post',
  'notify_submission_marked'
)
order by 1;
