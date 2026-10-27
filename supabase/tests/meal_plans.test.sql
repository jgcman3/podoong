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
insert into public.children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-09-01'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-09-01');
insert into public.child_access values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','editor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$insert into public.child_meal_plans values('20000000-0000-4000-8000-000000000001',180,array['08:00','12:00'],'Asia/Seoul')$$,'owner saves shared schedule');
select lives_ok($$insert into public.child_meal_plans values('20000000-0000-4000-8000-000000000002',null,'{}','UTC')$$,'owner can keep schedules unset');
select throws_ok($$update public.child_meal_plans set feeding_minutes=0$$,'23514',null,'invalid feeding interval rejected');
select throws_ok($$update public.child_meal_plans set solids_times=array['24:00']$$,'23514',null,'invalid clock time rejected');
select throws_ok($$update public.child_meal_plans set solids_times=array['08:00','12:00','18:00','20:00']$$,'23514',null,'more than three daily times rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.child_meal_plans),1,'viewer sees invited child only');
select is((select feeding_minutes from public.child_meal_plans),180,'viewer sees shared owner setting');
update public.child_meal_plans set feeding_minutes=240;
select is((select feeding_minutes from public.child_meal_plans),180,'viewer cannot change settings');
select throws_ok($$insert into public.child_meal_plans values('20000000-0000-4000-8000-000000000002',120,'{}','UTC')$$,'42501',null,'viewer cannot create sibling setting');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$update public.child_meal_plans set feeding_minutes=240 where child_id='20000000-0000-4000-8000-000000000001'$$,'editor can edit assigned child');
select is((select feeding_minutes from public.child_meal_plans),240,'editor update persisted');
select is((select count(*)::int from public.child_meal_plans),1,'editor cannot see unassigned sibling');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.child_meal_plans),0,'stranger cannot read family schedules');
select throws_ok($$insert into public.child_meal_plans values('20000000-0000-4000-8000-000000000001',120,'{}','UTC')$$,'42501',null,'stranger cannot write schedule');
reset role;
set local role anon;
select throws_ok($$select * from public.child_meal_plans$$,'42501',null,'anonymous schedule access denied');
reset role;
delete from public.children where id='20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.child_meal_plans),1,'child deletion removes only its schedule');
select * from finish();
rollback;
