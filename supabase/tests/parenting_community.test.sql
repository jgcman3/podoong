begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4)i;
insert into profiles(id,display_name,consented_at) select id,'Fixture',now() from auth.users where id::text like 'a9670000-%';
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9670000-0000-4000-8000-000000000001','Fixture','KR','서울특별시 강남구','역삼동'),
('b9670000-0000-4000-8000-000000000002','Fixture','KR','서울특별시 강남구','논현동'),
('b9670000-0000-4000-8000-000000000003','Fixture','KR','서울특별시 서초구','서초동'),
('b9670000-0000-4000-8000-000000000004','Fixture','KR','부산광역시 중구','중앙동');
insert into family_members(family_id,user_id,role,relationship) select ('b9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'owner','father' from generate_series(1,4)i;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000001')$$,'board needs no request or opening');
reset role;
insert into neighborhood_posts(region,feature,family_id,author_id,title,body,category) select neighborhood_region(family_id),'boards',family_id,user_id,'Fixture','Fixture',case when family_id::text like '%0002' then 'health' else 'childcare' end from family_members where family_id::text like 'b9670000-%';
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001')),4::bigint,'no area filter includes every district');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','city')),3::bigint,'city includes neighboring districts but not another city');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','district')),2::bigint,'district includes its localities');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','locality')),1::bigint,'locality narrows to the selected neighborhood');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','district','health')),1::bigint,'category and area combine');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001','district','all',null,'2611010100')),1::bigint,'browse another district without joining or changing family residence');
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000002')$$,'42501','forbidden','cannot read using another family');
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000001','invalid')$$,'22023','invalid scope','reject invalid scope');
select throws_ok($$select publish_parenting_support(gen_random_uuid(),'[]')$$,'42501',null,'family member cannot publish official data');
select throws_ok($$select begin_parenting_support_sync()$$,'42501',null,'family member cannot start a collection');
reset role;
select begin_parenting_support_sync() as run \gset
select is(begin_parenting_support_sync(),null::uuid,'a second worker cannot run concurrently');
select lives_ok(format($q$select publish_parenting_support(%L,'[{"id":"fixture-support","title":"아동 지원","summary":"","eligibility":"","benefit":"","application_period":"","agency":"Fixture","agency_type":"","url":"https://www.gov.kr/portal/fixture","region_terms":[],"national":true,"source_updated":"","collected_at":"2026-10-31T00:00:00Z"}]')$q$,:'run'),'complete snapshot publishes atomically');
select begin_parenting_support_sync() as second_run \gset
select throws_ok(format('select publish_parenting_support(%L,''[]'')',:'second_run'),'P0001','invalid sync','reject an empty response');
select ok((select active from parenting_support where id='fixture-support'),'failed refresh preserves existing active information');
set local role anon;
select throws_ok($$select * from parenting_support$$,'42501',null,'official catalogue is restricted to signed-in users');
select throws_ok($$select parenting_feed('b9670000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot access the board');
reset role;
select * from finish();
rollback;
