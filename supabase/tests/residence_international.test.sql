begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','owner@example.test');
insert into public.profiles(id,display_name,consented_at) values ('00000000-0000-4000-8000-000000000001','Test',now());
insert into public.families(id,name) values ('10000000-0000-4000-8000-000000000001','Test');
insert into public.family_members values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner');
-- Synthetic fixtures, not a real foreign-region catalogue. Rolled back at the end.
update public.residence_countries set enabled=false where code<>'KR';
select is((select enabled from public.residence_countries where code='US'),false,'new countries are disabled until explicitly released');
select lives_ok($$insert into public.residence_regions(country_code,code,city_name,locality_name,level,kind,selectable) values ('US','state-01','Test state','Test state',1,'state',false)$$,'foreign region codes can contain letters');
insert into public.residence_regions(country_code,code,city_name,locality_name,level,kind,selectable,parent_code,parent_level) values
('US','county-01','Test county','Test county',2,'county',false,'state-01',1),
('US','city-01','Test city','Test city',3,'city',false,'county-01',2),
('US','1168010100','Test city','Test neighborhood',4,'neighborhood',true,'city-01',3),
('US','neighborhood-B','Test city','Second neighborhood',4,'neighborhood',true,'city-01',3);
select is((select count(*)::int from public.residence_regions where code='1168010100'),2,'same code in different countries does not collide');
select is((select level::int from public.residence_regions where country_code='US' and code='1168010100'),4,'hierarchy is not limited to Korean three-step structure');
select throws_ok($$insert into public.residence_regions(country_code,code,city_name,locality_name,level,parent_code,parent_level) values ('US','bad-parent','Test','Test',2,'province:11',1)$$,'23503',null,'parent must belong to the same country');
select throws_ok($$update public.residence_regions set parent_code='1168010100',parent_level=4 where country_code='US' and code='state-01'$$,'23514',null,'levels prevent hierarchy cycles');
select throws_ok($$insert into public.residence_regions(country_code,code,city_name,locality_name) values ('ZZ','unknown','Test','Test')$$,'23503',null,'country must be registered');
select is((select count(*)::int from public.residence_countries where enabled),1,'only Korea is enabled in production catalogue');
select is((select count(*)::int from public.residence_regions where country_code='KR' and selectable),5067,'all Korean locality codes are preserved');
select is((select parent_code from public.residence_regions where country_code='KR' and code='1168010100'),'district:11680','Korean locality links to district');
select is((select parent_code from public.residence_regions where country_code='KR' and code='district:11680'),'province:11','Korean district links to province');
select is((select locality_name from public.residence_regions where country_code='KR' and code='4167035000'),'대신면','source trailing whitespace does not produce an empty locality');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$update public.residence_countries set enabled=true$$,'42501',null,'users cannot enable countries');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',0,'US')$$,'22023','invalid region','disabled country cannot be saved');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','province:11',0,'KR')$$,'22023','invalid region','non-selectable province is not a residence');
reset role;
update public.residence_countries set enabled=true where code='US';
update public.residence_regions set active=false where country_code='US' and code='state-01';
set local role authenticated;
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',0,'US')$$,'22023','invalid region','inactive ancestor prevents selecting its neighborhoods');
reset role;
update public.residence_regions set active=true where country_code='US' and code='state-01';
set local role authenticated;
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',0,'US')$$,'same save API supports newly enabled countries');
select is((select residence_country_code from public.families where id='10000000-0000-4000-8000-000000000001'),'US','selected country is stored');
select is((select residence_locality from public.families where id='10000000-0000-4000-8000-000000000001'),'Test neighborhood','names are resolved using country and code together');
select throws_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',0,'KR')$$,'P0001','conflict','country changes retain optimistic locking');
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','1168010100',1)$$,'Korean callers remain compatible with default country');
select is((select residence_locality from public.families where id='10000000-0000-4000-8000-000000000001'),'역삼동','country switch resolves Korean name');
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','neighborhood-B',2,'US')$$,'alphanumeric neighborhood code can be saved');
select lives_ok($$select public.save_family_residence_region('10000000-0000-4000-8000-000000000001','',3,'KR')$$,'removal still works');
select ok((select residence_country_code is null and residence_region_code is null from public.families where id='10000000-0000-4000-8000-000000000001'),'removal clears country and region');
select * from finish();
rollback;
