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
select lives_ok($$select public.save_calendar_event('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Clinic','2026-11-01','Visit','hospital','09:30','Asia/Seoul')$$,'hospital plan saves');
select lives_ok($$select public.save_calendar_event('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Medicine','2026-11-02','Dose note','medication','12:00','Asia/Seoul')$$,'medication plan saves');
select is((select event_time::text from public.events where id='30000000-0000-4000-8000-000000000001'),'09:30:00','appointment time retained');
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','Bad','2026-11-01','','hospital','09:30','invalid/zone')$$,'22023','invalid timezone','unknown timezone rejected');
select lives_ok($$select public.save_vaccination_record('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"other","custom_name":"Calendar vaccine","status":"planned","scheduled_date":"2026-11-03","timezone":"Asia/Seoul"}',null)$$,'vaccination plan saves');
select is((select count(*)::int from public.calendar_entries),3,'all plan types are unified');
select lives_ok($$select public.save_vaccination_record('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"other","custom_name":"Calendar vaccine","status":"planned","scheduled_date":"2026-11-04","timezone":"Asia/Seoul"}',1)$$,'vaccination date updates');
select is((select date::text from public.calendar_entries where source='vaccination'),'2026-11-04','calendar automatically reflects vaccine edits');
select is((select count(*)::int from public.calendar_entries where source='vaccination'),1,'no duplicate vaccine schedule');
select lives_ok($$select public.save_event('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Updated clinic','2026-11-05','')$$,'old event API is compatible');
select is((select event_kind from public.events where id='30000000-0000-4000-8000-000000000001'),'hospital','legacy edits retain event type');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.calendar_entries),3,'read-only family sees unified plans');
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','No','2026-11-01','','hospital','','')$$,'42501','forbidden','reader cannot register a plan');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.calendar_entries),0,'invoker view does not leak to unrelated users');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.delete_vaccination_record('40000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.calendar_entries where source='vaccination'),0,'vaccine deletion removes the schedule projection');
select is((select count(*)::int from public.events),2,'vaccine schedule never duplicates stored events');
select * from finish(); rollback;
