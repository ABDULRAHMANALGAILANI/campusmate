-- ============================================================
-- CampusMate: add a school and its first school admin
--
-- BEFORE running this:
--   Supabase -> Authentication -> Users -> Add user ->
--   Create new user. Type the admin's email and a password,
--   tick "Auto Confirm User", click Create user.
--
-- THEN: change the three lines marked  <-- CHANGE  and Run.
--
-- If a school with this name already exists (for example the
-- one made by 5-move-existing-users.sql), the admin is added
-- to that school instead of making a new one.
-- Safe to run more than once.
-- ============================================================

do $$
declare
  school_name  text := 'My School';             -- <-- CHANGE
  admin_email  text := 'admin@myschool.edu.my'; -- <-- CHANGE
  admin_name   text := 'First Last';            -- <-- CHANGE (real first + last name)

  the_school   uuid;
  admin_id     uuid;
begin

  select id into admin_id
  from auth.users
  where lower(email) = lower(trim(admin_email));

  if admin_id is null then
    raise exception
      'No account with the email %. Create it first in Authentication -> Users -> Add user.',
      admin_email;
  end if;

  -- Find or create the school
  select id into the_school
  from public.schools
  where lower(name) = lower(trim(school_name))
  limit 1;

  if the_school is null then
    insert into public.schools (name)
    values (trim(school_name))
    returning id into the_school;
  end if;

  -- Server-only details (users can't change these)
  update auth.users
  set raw_app_meta_data =
        coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
             'role', 'school_admin',
             'school_id', the_school
           )
  where id = admin_id;

  -- Profile (made automatically for most accounts)
  insert into public.profiles (id, full_name)
  values (admin_id, trim(admin_name))
  on conflict (id) do nothing;

  update public.profiles
  set role      = 'school_admin',
      school_id = the_school,
      full_name = trim(admin_name)
  where id = admin_id;

  raise notice 'Done: % is now the admin of %', admin_email, school_name;
end;
$$;


-- CHECK: your schools and their admins
select
  s.name        as school,
  p.full_name   as admin_name,
  u.email       as admin_email
from public.schools s
left join public.profiles p
  on p.school_id = s.id and p.role = 'school_admin'
left join auth.users u
  on u.id = p.id
order by s.name;
