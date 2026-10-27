begin;
-- Explicit user-requested backfill using today's date in Asia/Seoul.
-- No default: new registrations must still provide their actual birth date.
update public.children set birth_date=date '2026-10-28' where birth_date is null;
alter table public.children alter column birth_date set not null;
commit;
