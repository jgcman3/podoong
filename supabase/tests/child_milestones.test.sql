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
select lives_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-sit',true)$$,'owner checks milestone');
select lives_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-sit',true)$$,'repeat check is idempotent');
select is((select count(*)::int from public.child_milestones),1,'one observation per child and milestone');
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','unknown',true)$$,'22023','invalid milestone','unknown keys rejected');
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-sit',null)$$,'22023','invalid milestone','null state rejected');
select throws_ok($$insert into public.child_milestones(child_id,milestone_key) values('20000000-0000-4000-8000-000000000001','cdc-v1-9-name')$$,'42501',null,'direct writes denied');
select is(jsonb_array_length(public.export_child_data('20000000-0000-4000-8000-000000000001')->'milestones'),1,'export includes milestones');
select ok(not ((public.export_child_data('20000000-0000-4000-8000-000000000001')->'milestones'->0) ? 'recorded_by'),'export omits other family identity');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.child_milestones),1,'viewer can read shared child milestones');
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-sit',false)$$,'42501','forbidden','viewer cannot uncheck');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-sit',false)$$,'editor can uncheck');
select is((select count(*)::int from public.child_milestones),0,'unchecked observation removed');
select lives_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-name',true)$$,'editor can check');
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000002','cdc-v1-9-name',true)$$,'42501','forbidden','child-specific access enforced');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.child_milestones),0,'outsider cannot read observations');
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-name',true)$$,'42501','forbidden','outsider cannot write');
set local role anon;
select throws_ok($$select public.set_child_milestone('20000000-0000-4000-8000-000000000001','cdc-v1-9-name',true)$$,'42501',null,'anonymous RPC denied');
reset role;
delete from public.children where id='20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.child_milestones),0,'deleting child removes observations');
select * from finish(); rollback;
