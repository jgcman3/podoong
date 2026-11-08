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
\ir support/open-neighborhoods.inc
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Popular','Body',p_id=>'c9810000-0000-4000-8000-000000000001',p_child=>'c9670000-0000-4000-8000-000000000001');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','New','Body',p_id=>'c9810000-0000-4000-8000-000000000002',p_child=>'c9670000-0000-4000-8000-000000000001');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Too old','Body',p_id=>'c9810000-0000-4000-8000-000000000003',p_child=>'c9670000-0000-4000-8000-000000000001');
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Local only','Body',p_id=>'c9810000-0000-4000-8000-000000000004',p_child=>'c9670000-0000-4000-8000-000000000001');
select record_parenting_post_view('c9810000-0000-4000-8000-000000000001');
select record_parenting_post_view('c9810000-0000-4000-8000-000000000001');
select is((parenting_post_detail('c9810000-0000-4000-8000-000000000001')->>'views')::int,1,'same user same day counts once');
select is(parenting_post_detail('c9810000-0000-4000-8000-000000000001')->'author'->>'initial','F','author avatar exposes only first character');
select parenting_post_interact('c9810000-0000-4000-8000-000000000001','c9670000-0000-4000-8000-000000000001','like','on');
select parenting_post_interact('c9810000-0000-4000-8000-000000000001','c9670000-0000-4000-8000-000000000001','comment','One');
select parenting_post_interact('c9810000-0000-4000-8000-000000000001','c9670000-0000-4000-8000-000000000001','comment','Two');
reset role;
update neighborhood_posts set created_at=now()-interval '1 hour' where id='c9810000-0000-4000-8000-000000000001';
update neighborhood_posts set created_at=now()-interval '8 days',view_count=100 where id='c9810000-0000-4000-8000-000000000003';
update neighborhood_posts set created_at=now()-interval '2 hours' where id='c9810000-0000-4000-8000-000000000004';
set local role authenticated;
select is((select title from parenting_feed('b9670000-0000-4000-8000-000000000001') limit 1),'New','all remains chronological');
select is((select title from parenting_feed('b9670000-0000-4000-8000-000000000001',p_sort=>'popular') limit 1),'Popular','engagement outweighs recency in popular mode');
select is((select rank_score from parenting_feed('b9670000-0000-4000-8000-000000000001',p_sort=>'popular') where title='Popular'),8::bigint,'score uses distinct commenters, not duplicate comments');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_sort=>'popular')),3::bigint,'old posts are excluded from neighborhood popularity');
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001',p_sort=>'popular',p_before=>now()-interval '1 hour',p_before_id=>'c9810000-0000-4000-8000-000000000001',p_before_score=>8)),2::bigint,'popularity cursor continues after previous score');
select throws_ok($$select * from parenting_post_views$$,'42501',null,'raw viewing history stays private');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select record_parenting_post_view('c9810000-0000-4000-8000-000000000001');
select is((parenting_post_detail('c9810000-0000-4000-8000-000000000001')->>'views')::int,2,'another viewer increments once');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select record_parenting_post_view('c9810000-0000-4000-8000-000000000001')$$,'42501','forbidden','another country cannot add views');
reset role;
select * from finish();rollback;
