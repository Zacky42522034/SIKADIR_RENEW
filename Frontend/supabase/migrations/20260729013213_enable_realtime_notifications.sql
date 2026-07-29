-- Enable Supabase Realtime for notifications table
begin;
  -- remove the supabase_realtime publication if it exists
  drop publication if exists supabase_realtime;

  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;
commit;

-- add the tables we want to track
alter publication supabase_realtime add table public.notifications;
