-- ============================================================
-- CampusMate: daily email of notifications
--
-- Once a day every person who has unread notifications gets
-- ONE email listing them (new assignments, marks released,
-- "due soon" reminders, answers, excuses...). Nothing is sent
-- if there's nothing new. Each notification is emailed once.
-- People can turn it off in Settings -> Email notifications.
--
-- The email itself is sent by the Edge Function
-- "send-daily-email" (supabase/functions/send-daily-email).
-- The daily timer is in 21-schedule-daily-email.sql.
--
-- Run once in Supabase -> SQL Editor. Safe to run more than once.
-- ============================================================


-- 1. Settings + bookkeeping
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

alter table public.notifications
  add column if not exists emailed_at timestamptz;

create index if not exists notifications_not_emailed
  on public.notifications (user_id)
  where emailed_at is null and is_read = false;


-- People turn their own email on/off (Settings)
create or replace function public.set_email_notifications(input_on boolean)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles
  set email_notifications = coalesce(input_on, true)
  where id = auth.uid();
$$;

revoke execute on function public.set_email_notifications(boolean) from public, anon;
grant  execute on function public.set_email_notifications(boolean) to authenticated;


-- 2. "Due soon" reminders for EVERY student (not only the ones
--    who opened the app today), so they appear in the email.
--    Skips archived classes and items with nothing to hand in.
create or replace function public.create_due_soon_reminders_all()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  made integer;
begin
  insert into public.notifications
    (user_id, notification_key, title, message, category, link, is_read)
  select
    m.student_id,
    'due_soon_' || a.id,
    'Due soon: ' || a.title,
    public.class_label(a.group_id)
      || ' · due '
      || to_char(a.due_at at time zone 'Asia/Kuala_Lumpur', 'Dy DD Mon, HH12:MI AM'),
    'assignment',
    '/classes/' || a.group_id,
    false
  from public.class_assignments a
  join public.course_groups g
    on g.id = a.group_id
   and g.archived_at is null
  join public.course_group_members m
    on m.group_id = a.group_id
   and m.status = 'active'
  where coalesce(a.hand_in, true)
    and a.due_at > now()
    and a.due_at <= now() + interval '30 hours'
    and not exists (
      select 1 from public.assignment_submissions s
      where s.assignment_id = a.id
        and s.student_id = m.student_id
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.student_id
        and n.notification_key = 'due_soon_' || a.id
    );

  get diagnostics made = row_count;
  return made;
end;
$$;

revoke execute on function public.create_due_soon_reminders_all() from public, anon, authenticated;
grant  execute on function public.create_due_soon_reminders_all() to service_role;


-- 3. Who gets an email today, and what goes in it.
--    Only unread notifications from the last 3 days that
--    haven't been emailed yet. Accounts that were turned off by
--    the school (banned) are skipped by the Edge Function.
create or replace function public.email_digest_list(only_user uuid default null)
returns table (
  user_id   uuid,
  email     text,
  full_name text,
  items     jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p.id,
    u.email::text,
    p.full_name,
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'message', n.message,
        'category', n.category,
        'link', n.link,
        'created_at', n.created_at
      )
      order by n.created_at desc
    )
  from public.notifications n
  join public.profiles p on p.id = n.user_id
  join auth.users u on u.id = n.user_id
  where n.is_read = false
    and n.emailed_at is null
    and n.created_at > now() - interval '3 days'
    and coalesce(u.email, '') <> ''
    and (
      (only_user is null and p.email_notifications)
      or p.id = only_user
    )
  group by p.id, u.email, p.full_name;
$$;

revoke execute on function public.email_digest_list(uuid) from public, anon, authenticated;
grant  execute on function public.email_digest_list(uuid) to service_role;


-- (ids as text so it works whatever type the id column is)
create or replace function public.mark_notifications_emailed(ids text[])
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.notifications
  set emailed_at = now()
  where id::text = any(ids);
$$;

revoke execute on function public.mark_notifications_emailed(text[]) from public, anon, authenticated;
grant  execute on function public.mark_notifications_emailed(text[]) to service_role;


-- Done. Next: deploy the send-daily-email Edge Function, add its
-- secrets, then run 21-schedule-daily-email.sql.

select 'daily email' as item, 'ok' as status;
