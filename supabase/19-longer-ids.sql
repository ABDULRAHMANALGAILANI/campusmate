-- ============================================================
-- CampusMate: longer CampusMate IDs (10 digits)
--
-- Old:  STU-000123      PRO-000012
-- New:  STU-2026000123  PRO-2026000012   ADM-2026000001
--       prefix + year joined + 6-digit number = 10 digits,
--       like university matric numbers (e.g. usm202504109).
--
-- * New accounts get the new format automatically.
-- * Existing accounts are converted once (oldest first), so
--   everyone has the same format. Tell your users their new ID
--   is shown on their Profile page.
-- * Changing someone's role (student <-> professor) gives them
--   an ID with the right prefix.
-- * Room for 999,999 accounts per role per year. After that the
--   number simply gets longer instead of breaking.
--
-- Run once in Supabase -> SQL Editor. Safe to run more than once.
-- ============================================================


-- One counter per prefix per year
create table if not exists public.campus_id_counters (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

alter table public.campus_id_counters enable row level security;
-- No policies: only the functions below (security definer) use it.
revoke all on public.campus_id_counters from anon, authenticated;


create or replace function public.campus_id_prefix(input_role text)
returns text
language sql
immutable
as $$
  select case coalesce(input_role, 'student')
    when 'student'      then 'STU'
    when 'professor'    then 'PRO'
    when 'school_admin' then 'ADM'
    else 'USR'
  end;
$$;


-- True for the new format (prefix + at least 10 digits)
create or replace function public.is_long_campus_id(input_id text, input_role text)
returns boolean
language sql
immutable
as $$
  select coalesce(input_id, '') ~ ('^' || public.campus_id_prefix(input_role) || '-[0-9]{10,}$');
$$;


create or replace function public.next_campus_id(input_role text, input_year integer default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  the_prefix text := public.campus_id_prefix(input_role);
  the_year   integer := coalesce(input_year, extract(year from now())::integer);
  the_number integer;
  candidate  text;
begin
  loop
    insert into public.campus_id_counters as c (prefix, year, last_value)
    values (the_prefix, the_year, 1)
    on conflict (prefix, year) do update set last_value = c.last_value + 1
    returning last_value into the_number;

    candidate :=
      the_prefix || '-' || the_year::text
      || lpad(the_number::text, greatest(6, length(the_number::text)), '0');

    -- Never hand out an ID someone already has
    exit when not exists (
      select 1 from public.profiles where upper(trim(campus_id)) = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke execute on function public.next_campus_id(text, integer) from public, anon, authenticated;


-- Runs after any older ID trigger ("zz_" = last), so the new
-- format always wins.
create or replace function public.assign_campus_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- set only while converting old accounts (below)
  wanted_year integer := nullif(current_setting('campusmate.id_year', true), '')::integer;
begin
  -- People can't change their own ID from the app
  if tg_op = 'UPDATE'
     and new.campus_id is distinct from old.campus_id
     and new.role is not distinct from old.role
     and coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon') then
    new.campus_id := old.campus_id;
  end if;

  -- New account, old-style ID, or role changed (wrong prefix)
  if not public.is_long_campus_id(new.campus_id, new.role) then
    new.campus_id := public.next_campus_id(new.role, wanted_year);
  end if;

  return new;
end;
$$;

drop trigger if exists zz_assign_campus_id on public.profiles;
create trigger zz_assign_campus_id
before insert or update on public.profiles
for each row execute function public.assign_campus_id();


-- ------------------------------------------------------------
-- Convert existing accounts (oldest first, by the year they
-- joined). The old ID is kept in old_campus_id for reference.
-- ------------------------------------------------------------

alter table public.profiles add column if not exists old_campus_id text;

do $$
declare
  person record;
begin
  for person in
    select p.id,
           extract(year from coalesce(u.created_at, now()))::integer as joined_year
    from public.profiles p
    left join auth.users u on u.id = p.id
    where not public.is_long_campus_id(p.campus_id, p.role)
    order by coalesce(u.created_at, now()), p.id
  loop
    perform set_config('campusmate.id_year', person.joined_year::text, true);

    -- the trigger above gives the new ID
    update public.profiles
    set old_campus_id = coalesce(old_campus_id, nullif(trim(campus_id), ''))
    where id = person.id;
  end loop;

  perform set_config('campusmate.id_year', '', true);
end;
$$;


-- Done. Check with:
--   select full_name, role, campus_id, old_campus_id from public.profiles order by campus_id;

select role, count(*) as accounts, min(campus_id) as first_id, max(campus_id) as last_id
from public.profiles
group by role
order by role;
