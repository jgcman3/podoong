begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','owner@example.test'),
('00000000-0000-4000-8000-000000000002','viewer@example.test'),
('00000000-0000-4000-8000-000000000003','editor@example.test'),
('00000000-0000-4000-8000-000000000004','stranger@example.test');
insert into public.profiles(id,display_name,consented_at) select id,'Test',now() from auth.users
where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');
insert into public.families(id,name) values('10000000-0000-4000-8000-000000000001','Test');
insert into public.family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','editor');
insert into public.children(id,family_id,name,birth_date) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-09-01'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-09-01');
insert into public.child_access values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','editor');
-- Recreate the previous schema inside this rollback-only transaction.
alter table public.care_records drop constraint care_records_kind_check;
alter table public.care_records drop constraint care_record_amount_units;
alter table public.care_records add constraint care_records_kind_check check(kind in ('breast','formula','solids','pump','expressed','meal'));
alter table public.care_records add constraint care_record_amount_units check((kind in ('solids','meal') and amount_ml is null) or (kind not in ('solids','meal') and amount_g is null));
alter table public.child_meal_plans add column meal_times text[] not null default '{}';
insert into public.child_meal_plans(child_id,feeding_minutes,solids_times,meal_times,timezone) values('20000000-0000-4000-8000-000000000001',180,array['08:00'],array['12:00'],'Asia/Seoul');
insert into public.care_records(id,child_id,kind,started_at,ended_at,created_by,updated_by)
select gen_random_uuid(),'20000000-0000-4000-8000-000000000001',kind,now(),now(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'
from unnest(array['breast','formula','solids','pump','expressed','meal']) kind;
insert into public.notifications(recipient_id,child_id,kind,reference_id,dedupe_key,scheduled_at)
select '00000000-0000-4000-8000-000000000001',child_id,'feeding',id,'remove-test:'||id,now() from public.care_records where child_id='20000000-0000-4000-8000-000000000001' and kind='expressed';
select is((select count(*)::int from public.care_records where child_id='20000000-0000-4000-8000-000000000001'),6,'fixture includes all previous types');
\ir ../migrations/202610140011_remove_deprecated_feeding.sql
select is((select count(*)::int from public.care_records where child_id='20000000-0000-4000-8000-000000000001'),3,'cleanup preserves the three supported types');
select is((select count(*)::int from public.care_records where kind in ('pump','expressed','meal')),0,'deprecated records are deleted');
select is((select count(*)::int from public.notifications where dedupe_key like 'remove-test:%'),0,'linked deprecated reminders are removed');
select hasnt_column('public','child_meal_plans','meal_times','daily meal schedule data is removed');
select is((select feeding_minutes from public.child_meal_plans where child_id='20000000-0000-4000-8000-000000000001'),180,'milk interval remains');
select is((select solids_times from public.child_meal_plans where child_id='20000000-0000-4000-8000-000000000001'),array['08:00'],'solids schedule remains');
select throws_ok($$insert into public.care_records(id,child_id,kind,started_at,created_by,updated_by) values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','meal',now(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001')$$,'23514',null,'meal cannot be recreated');
select throws_ok($$insert into public.care_records(id,child_id,kind,started_at,created_by,updated_by) values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','pump',now(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001')$$,'23514',null,'pump cannot be recreated');
select throws_ok($$insert into public.care_records(id,child_id,kind,started_at,created_by,updated_by) values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','expressed',now(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001')$$,'23514',null,'expressed cannot be recreated');
select * from finish();
rollback;
