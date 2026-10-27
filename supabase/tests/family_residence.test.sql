begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','owner@example.test'),
('00000000-0000-4000-8000-000000000002','viewer@example.test'),
('00000000-0000-4000-8000-000000000003','stranger@example.test');
insert into public.profiles(id,display_name,consented_at) select id,'Test',now() from auth.users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into public.families(id,name) values('10000000-0000-4000-8000-000000000001','Test Family');
insert into public.family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');
insert into public.children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-10-20'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-10-20');
insert into public.child_access values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');


set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select residence_city from public.families where id='10000000-0000-4000-8000-000000000001'),null,'existing family starts without an inferred city');
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',0)$$,'owner saves residence');
select is((select residence_city from public.families where id='10000000-0000-4000-8000-000000000001'),'서울특별시 강남구','city is trimmed');
select is((select residence_locality from public.families where id='10000000-0000-4000-8000-000000000001'),'역삼동','dong is stored');
select is((select residence_country_code from public.families where id='10000000-0000-4000-8000-000000000001'),'KR','country code stored');
select is((select residence_region_code from public.families where id='10000000-0000-4000-8000-000000000001'),'1168010100','legal locality code stored');
select throws_ok($$update public.residence_regions set locality_name='forged'$$,'42501',null,'users cannot forge region labels');
select is((select residence_version from public.families where id='10000000-0000-4000-8000-000000000001'),1,'version increments');
select ok((select residence_updated_at is not null from public.families where id='10000000-0000-4000-8000-000000000001'),'update time is saved');
select is((select count(*)::int from public.audit_events where action='family_residence_saved'),1,'save is audited without location text');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',0)$$,'P0001','conflict','stale edit cannot overwrite current residence');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','9999999999',1)$$,'22023','invalid region','unknown region rejected');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1100000000',1)$$,'22023','invalid region','province cannot be saved as a neighborhood');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168000000',1)$$,'22023','invalid region','district cannot be saved as a neighborhood');
select throws_ok($$update public.families set residence_city='forged'$$,'42501',null,'direct unaudited updates denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select residence_locality from public.families where id='10000000-0000-4000-8000-000000000001'),'역삼동','family viewer can read common residence');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',1)$$,'42501','forbidden','viewer cannot change residence');
reset role;
update public.family_members set role='editor' where user_id='00000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',1)$$,'42501','forbidden','child editor cannot change family settings');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.families),0,'another family cannot read residence');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',1)$$,'42501','forbidden','another family cannot change residence');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',1)$$,'myeon location saves');
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','',2)$$,'owner can remove location');
select ok((select residence_city is null and residence_locality is null and residence_country_code is null and residence_region_code is null from public.families where id='10000000-0000-4000-8000-000000000001'),'cleared residence is null, not fabricated');
set local role anon;
select throws_ok($$select * from public.families$$,'42501',null,'anonymous users cannot read families');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','4183033000',3)$$,'42501',null,'anonymous users cannot call save');
select * from finish();
rollback;
