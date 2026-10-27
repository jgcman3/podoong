begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','context-owner@example.test'),
('00000000-0000-4000-8000-000000000002','context-viewer@example.test');
insert into profiles(id,display_name,consented_at) select id,'Test',now() from auth.users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into families(id,name) values ('10000000-0000-4000-8000-000000000001','Test');
insert into family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');
insert into children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-01-01'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-01-01');
insert into child_access values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok((select owner and writable from family_access_context('20000000-0000-4000-8000-000000000001')),'owner retains write permission');
select is((select family->>'name' from family_access_context('20000000-0000-4000-8000-000000000001')),'Test','family returned');
select is((select jsonb_array_length(members) from family_access_context('20000000-0000-4000-8000-000000000001')),2,'membership returned');
select is((select jsonb_array_length(caregivers) from family_access_context('20000000-0000-4000-8000-000000000002')),1,'caregivers scoped to child');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok((select not owner and not writable from family_access_context('20000000-0000-4000-8000-000000000001')),'viewer remains read-only');
select throws_ok($$select family_access_context('20000000-0000-4000-8000-000000000002')$$,'42501','forbidden','viewer cannot load sibling without access');
reset role;
delete from child_access where user_id='00000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select family_access_context('20000000-0000-4000-8000-000000000001')$$,'42501','forbidden','revoked access takes effect immediately');
reset role;
set local role anon;
select throws_ok($$select family_access_context('20000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous access denied');
reset role;
select * from finish();
rollback;
