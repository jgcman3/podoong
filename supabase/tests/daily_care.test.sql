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
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','activity','{"kind":"temperature","occurred_at":"2026-10-25T01:00Z","temperature_c":37.2,"timezone":"Asia/Seoul"}',null)$$,'temperature persists as numeric Celsius');
select is((select temperature_c from public.child_records limit 1),37.2::numeric,'exact temperature retained');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','activity','{"kind":"temperature","occurred_at":"2026-10-25T01:00Z","timezone":"UTC"}',null)$$,'23514',null,'temperature cannot be omitted');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','activity','{"kind":"medication","occurred_at":"2026-10-25T01:00Z","timezone":"UTC"}',null)$$,'23514',null,'medication requires a type or name');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','activity','{"kind":"medication","occurred_at":"2026-10-25T01:00Z","medicine_name":"Test medicine","dose_amount":2.5,"dose_unit":"ml","timezone":"UTC"}',null)$$,'explicit medication dose saves');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','activity','{"kind":"tummy","occurred_at":"2026-10-25T01:00Z","duration_minutes":5,"timezone":"UTC"}',null)$$,'tummy time duration saves');
select is((public.export_child_data('20000000-0000-4000-8000-000000000001')->'child_records'->0->>'temperature_c')::numeric,37.2::numeric,'export retains structured temperature');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','activity','{"kind":"medication","occurred_at":"2026-10-25T01:00Z","medicine_name":"Fever medicine","timezone":"UTC"}',null)$$,'medication type saves without dose');
select ok((select dose_amount is null and dose_unit is null from public.child_records where id='30000000-0000-4000-8000-000000000004'),'unrecorded dose stays null');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','activity','{"kind":"medication","occurred_at":"2026-10-25T01:00Z","medicine_name":"Test","dose_amount":2,"timezone":"UTC"}',null)$$,'23514',null,'partial dose remains invalid');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.child_records),4,'reader sees shared activity records');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','activity','{"kind":"play","occurred_at":"2026-10-25T01:00Z","timezone":"UTC"}',null)$$,'42501','forbidden','reader cannot write');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.child_records),0,'unrelated users cannot read activity');
select * from finish(); rollback;
