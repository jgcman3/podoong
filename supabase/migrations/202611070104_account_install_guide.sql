begin;
alter table public.profiles add column install_guide_seen_at timestamptz;
notify pgrst, 'reload schema';
commit;
