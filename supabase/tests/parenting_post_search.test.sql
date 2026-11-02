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
insert into children(id,family_id,name,birth_date,sex) select ('c9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Fixture child',current_date,'female' from generate_series(1,5)i;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','산책 후기','유모차로 가기 좋아요',p_id=>'c9830000-0000-4000-8000-000000000001',p_child=>'c9670000-0000-4000-8000-000000000001');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','gear','100%_real','Literal needle',p_id=>'c9830000-0000-4000-8000-000000000002',p_child=>'c9670000-0000-4000-8000-000000000001');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','동네 산책','유모차 친구를 찾아요',p_id=>'c9830000-0000-4000-8000-000000000003',p_child=>'c9670000-0000-4000-8000-000000000001',p_audience=>'neighborhood');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'산책')),1::bigint,'Korean title search excludes neighborhood-only post from country feed');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'유모차')),1::bigint,'Korean body is searchable');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_neighborhood=>true,p_query=>'유모차')),1::bigint,'neighborhood search respects audience');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'100%_')),1::bigint,'wildcard characters are literal');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'___')),0::bigint,'underscore cannot match all posts');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'literal')),1::bigint,'search ignores Latin letter case');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'유모차',p_category=>'gear')),0::bigint,'category remains active during search');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>'유모차',p_sort=>'popular')),1::bigint,'popular search is supported');
select throws_ok($$select * from parenting_feed('b9670000-0000-4000-8000-000000000001',p_query=>repeat('x',81))$$,'22023','invalid search','search length is checked on server');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000004',p_query=>'유모차')),0::bigint,'another country cannot find matching posts');
reset role;
select * from finish();rollback;
