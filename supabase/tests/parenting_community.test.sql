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
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region(family_id),'boards',family_id,user_id,'Fixture '||right(family_id::text,1),'Fixture',case right(family_id::text,1) when '1' then 'play' when '2' then 'gear' when '3' then 'feeding' when '4' then 'travel' else 'discipline' end from family_members where family_id::text like 'b9670000-%';
insert into children(id,family_id,name,birth_date,sex) values('c9670000-0000-4000-8000-000000000001','b9670000-0000-4000-8000-000000000001','Fixture child',current_date,'female');
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001')),4::bigint,'All includes all topics from the home country only');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',true)),0::bigint,'country posts are not automatically listed in a dong');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',false,'gear')),1::bigint,'country topic filter works');
select is((select area_label from parenting_feed('b9670000-0000-4000-8000-000000000001') where title='Fixture 2'),'서울특별시 강남구 역삼동','cards expose coarse author residence');
select ok(to_regprocedure('public.parenting_feed(uuid,text,text,timestamptz,text,text,uuid)') is null,'old region-filter API is removed');
select ok(to_regprocedure('public.save_parenting_post(uuid,text,text,text,text,text)') is null,'old browse/market write API is removed');
select ok(to_regprocedure('public.parenting_friends(uuid,text,text,timestamptz,uuid)') is null,'old profile-only roster is removed');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','health','Snapshot post','Fixture',p_child=>'c9670000-0000-4000-8000-000000000001') as saved \gset
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000002')$$,'42501','forbidden','cannot query as another family');
reset role;
update families set residence_locality='새동네' where id='b9670000-0000-4000-8000-000000000001';
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region('b9670000-0000-4000-8000-000000000003'),'boards','b9670000-0000-4000-8000-000000000003','a9670000-0000-4000-8000-000000000003','Travel weekly','Fixture','travel' from generate_series(1,3);
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category,created_at) select neighborhood_region('b9670000-0000-4000-8000-000000000003'),'boards','b9670000-0000-4000-8000-000000000003','a9670000-0000-4000-8000-000000000003','Old play','Fixture','play',now()-interval '8 days' from generate_series(1,20);
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region('b9670000-0000-4000-8000-000000000004'),'boards','b9670000-0000-4000-8000-000000000004','a9670000-0000-4000-8000-000000000004','US gear','Fixture','gear' from generate_series(1,50);
set local role authenticated;
select is((select area_label from parenting_feed('b9670000-0000-4000-8000-000000000001') where id=:'saved'),'서울특별시 강남구 역삼동','moving residence does not rewrite an existing post');
select is((select category from parenting_topics('b9670000-0000-4000-8000-000000000001') limit 1),'travel','current week post count ranks topics within the home country');
select is((select posts from parenting_topics('b9670000-0000-4000-8000-000000000001') where category='play'),1::bigint,'old weeks do not affect topic popularity');
select is((select posts from parenting_topics('b9670000-0000-4000-8000-000000000001') where category='gear'),1::bigint,'another country does not affect topic popularity');
select is((select count(*) from parenting_topics('b9670000-0000-4000-8000-000000000001')),11::bigint,'all requested topics remain selectable including zero-post topics');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000004')),50::bigint,'foreign country feed stays paginated');
select ok((select bool_and(title in ('US gear','Fixture 4')) from parenting_feed('b9670000-0000-4000-8000-000000000004')),'foreign feed never includes Korean posts');
reset role;
set local role anon;
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot access the board');
select throws_ok($$select parenting_topics('b9670000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot access country topic stats');
reset role;
select ok(to_regclass('public.parenting_support') is null,'removed support catalogue has no table');
select is((select count(*) from cron.job where jobname='podoong-parenting-support'),0::bigint,'support collection is not scheduled');
select is((select count(*) from vault.secrets where name='podoong_support_worker'),0::bigint,'support worker Vault token is removed');
select * from finish();rollback;
