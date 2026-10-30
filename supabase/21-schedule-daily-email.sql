-- ============================================================
-- CampusMate: send the daily email every morning
--
-- Calls the send-daily-email Edge Function at 7:00 am Malaysia
-- time (23:00 UTC the day before) every day.
--
-- BEFORE running, replace the two values below IN THE SQL EDITOR
-- ONLY (don't save them into your project files):
--   YOUR-PROJECT-REF  the part before .supabase.co in your
--                     Supabase URL (Settings -> API)
--   YOUR-CRON-SECRET  the same text you saved as the
--                     CRON_SECRET Edge Function secret
--
-- Needs the pg_cron and pg_net extensions: Supabase ->
-- Database -> Extensions -> turn on "pg_cron" and "pg_net"
-- (the lines below also try to turn them on).
--
-- Run again any time to change the time or the secret.
-- To stop the emails:  select cron.unschedule('campusmate-daily-email');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove the old schedule if there is one
select cron.unschedule(jobid)
from cron.job
where jobname = 'campusmate-daily-email';

select cron.schedule(
  'campusmate-daily-email',
  '0 23 * * *',   -- 23:00 UTC = 7:00 am in Malaysia
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-daily-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'YOUR-CRON-SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Check it's there:
--   select jobname, schedule, active from cron.job;
-- See the last runs:
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
