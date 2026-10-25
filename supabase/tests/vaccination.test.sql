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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","dose":1,"season":"2026-2027","timezone":"Asia/Seoul"}',null)$$,'owner saves a seasonal flu plan');
select lives_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',null)$$,'same submission is idempotent');
select is((select count(*)::int from vaccination_records),1,'retry does not duplicate');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","timezone":"Asia/Seoul"}',null)$$,'23514',null,'planned date is required');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"completed","timezone":"Asia/Seoul"}',null)$$,'23514',null,'actual date is required');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001',jsonb_build_object('vaccine','influenza','status','completed','completed_date',current_date+2,'timezone','Asia/Seoul'),null)$$,'22023','future completion','future actual dates are rejected');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","season":"2026-2028","timezone":"Asia/Seoul"}',null)$$,'23514',null,'season years must be consecutive');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"other","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',null)$$,'23514',null,'custom vaccine requires a name');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","dose":0,"timezone":"Asia/Seoul"}',null)$$,'23514',null,'invalid dose rejected');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","timezone":"Invalid/Zone"}',null)$$,'22023','invalid timezone','invalid timezone rejected');
select lives_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"completed","scheduled_date":"2026-10-21","completed_date":"2026-10-01","dose":1,"season":"2026-2027","clinic":"Test clinic","timezone":"Asia/Seoul"}',1)$$,'owner marks plan completed with actual date');
select is((select version from vaccination_records where id='30000000-0000-4000-8000-000000000001'),2,'edit increments version');
select throws_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',1)$$,'P0001','conflict','stale edit rejected');
select throws_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',2)$$,'42501','forbidden','record cannot move children');
select is(jsonb_array_length(export_child_data('20000000-0000-4000-8000-000000000001')->'vaccinations'),1,'export includes vaccination history');
select ok(not ((export_child_data('20000000-0000-4000-8000-000000000001')->'vaccinations'->0)?'created_by'),'export removes author identifiers');
select throws_ok($$delete from vaccination_records$$,'42501',null,'direct mutation is denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from vaccination_records),1,'assigned viewer can read');
select throws_ok($$select delete_vaccination_record('30000000-0000-4000-8000-000000000001')$$,'42501','forbidden','viewer cannot delete');
select throws_ok($$select save_vaccination_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','{"vaccine":"influenza","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',null)$$,'42501','forbidden','viewer cannot save');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from vaccination_records),0,'stranger cannot read');
select throws_ok($$select export_child_data('20000000-0000-4000-8000-000000000001')$$,'42501','forbidden','stranger cannot export');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select save_vaccination_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','{"vaccine":"hepb","status":"planned","scheduled_date":"2026-10-21","timezone":"Asia/Seoul"}',null)$$,'assigned editor can add');
select lives_ok($$select delete_vaccination_record('30000000-0000-4000-8000-000000000002')$$,'editor can delete');
reset role;
delete from public.profiles where id='00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from vaccination_records),1,'shared records survive author deletion');
select ok((select created_by is null and updated_by is null from vaccination_records where id='30000000-0000-4000-8000-000000000001'),'deleted author is anonymized');
delete from public.children where id='20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from vaccination_records),0,'child deletion cascades');
set local role anon;
select throws_ok($$select * from public.vaccination_records$$,'42501',null,'anonymous users cannot read');
select * from finish();
rollback;
