begin;
-- Missing bottle/solid feeding duration is unknown, not an active timer.
drop index public.one_active_timer;
create unique index one_active_timer on public.care_records(child_id,created_by)
where kind='breast' and ended_at is null;
commit;
