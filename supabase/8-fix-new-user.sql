-- ============================================================
-- CampusMate: let accounts without a name be created
--
-- Problem: every new account makes a profile straight away.
-- Accounts added in the Supabase dashboard have no name, the
-- name check rejects the empty name, and the whole account
-- fails ("Database error creating new user").
--
-- Fix: only make the profile automatically when a name was
-- given. Sign-up and the School admin page always give one.
-- Accounts made in the dashboard get their profile from
-- 7-create-school.sql instead.
-- Safe to run more than once.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  given_name text :=
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin

  if given_name = '' then
    return new;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, given_name)
  on conflict (id) do nothing;

  return new;

end;
$function$;
