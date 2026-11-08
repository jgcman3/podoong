begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5)i;
insert into profiles(id,display_name,consented_at) select id,'Fixture',now() from auth.users where id::text like 'a9670000-%';
insert into families(id,name,residence_country_code,residence_province,residence_city,residence_locality) values
('b9670000-0000-4000-8000-000000000001','Fixture','KR',null,'서울특별시 강남구','역삼동'),
('b9670000-0000-4000-8000-000000000002','Fixture','KR',null,'서울특별시 강남구','역삼동'),
('b9670000-0000-4000-8000-000000000003','Fixture','KR',null,'서울특별시 서초구','서초동'),
('b9670000-0000-4000-8000-000000000004','Fixture','US','California','San Francisco','Downtown'),
('b9670000-0000-4000-8000-000000000005','Fixture','KR',null,'서울특별시 강남구','논현동');
insert into family_members(family_id,user_id,role,relationship) select ('b9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'owner','father' from generate_series(1,5)i;
\ir support/open-neighborhoods.inc
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region(family_id),'boards',family_id,user_id,'Fixture '||right(family_id::text,1),'Fixture',case right(family_id::text,1) when '1' then 'play' when '2' then 'gear' when '3' then 'feeding' when '4' then 'travel' else 'discipline' end from family_members where family_id::text like 'b9670000-%';
insert into children(id,family_id,name,birth_date,sex) values('c9670000-0000-4000-8000-000000000001','b9670000-0000-4000-8000-000000000001','Fixture child',current_date,'female');
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001')),2::bigint,'feed includes only the current neighborhood');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','gear')),1::bigint,'neighborhood topic filter works');
select is((select area_label from parenting_feed('b9670000-0000-4000-8000-000000000001') where title='Fixture 2'),'서울특별시 강남구 역삼동','cards expose coarse author residence');
select ok(to_regprocedure('public.parenting_feed(uuid,text,text,timestamptz,text,text,uuid)') is null,'old region-filter API is removed');
select ok(to_regprocedure('public.save_parenting_post(uuid,text,text,text,text,text)') is null,'old browse/market write API is removed');
select ok(to_regprocedure('public.parenting_topics(uuid)') is null,'fixed topics do not require weekly popularity queries');
select ok(to_regprocedure('public.parenting_friends(uuid,text,text,timestamptz,uuid)') is null,'old profile-only roster is removed');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','health','Snapshot post','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001') as saved \gset
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000002')$$,'42501','forbidden','cannot query as another family');
select lives_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','daily','Daily fixture','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001')$$,'daily category can be saved');
select lives_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','other','Other fixture','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001')$$,'other category can be saved');
select lives_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','local-other','Local other fixture','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001')$$,'other neighborhood category can be saved');
select lives_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','local-outings','Neighborhood outing fixture','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001')$$,'local outings category can be saved');
select lives_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','local-market','Neighborhood sharing fixture','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001')$$,'sharing and resale category can be saved');
reset role;
update families set residence_locality='새동네' where id='b9670000-0000-4000-8000-000000000001';
\ir support/open-neighborhoods.inc
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region('b9670000-0000-4000-8000-000000000004'),'boards','b9670000-0000-4000-8000-000000000004','a9670000-0000-4000-8000-000000000004','US gear','Fixture','gear' from generate_series(1,50);
set local role authenticated;
select is((parenting_post_detail(:'saved')->>'area'),'서울특별시 강남구 역삼동','moving residence does not rewrite an existing post');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000004')),50::bigint,'foreign neighborhood feed stays paginated');
select ok((select bool_and(title in ('US gear','Fixture 4')) from parenting_feed('b9670000-0000-4000-8000-000000000004')),'foreign feed never includes Korean posts');
reset role;
set local role anon;
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot access the board');
reset role;
select ok(to_regclass('public.parenting_support') is null,'removed support catalogue has no table');
select is((select count(*) from cron.job where jobname='podoong-parenting-support'),0::bigint,'support collection is not scheduled');
select is((select count(*) from vault.secrets where name='podoong_support_worker'),0::bigint,'support worker Vault token is removed');
select * from finish();rollback;
