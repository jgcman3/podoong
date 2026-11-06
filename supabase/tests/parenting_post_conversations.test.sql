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
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Poll post','Body #play',p_child=>'c9670000-0000-4000-8000-000000000001',p_poll=>' {"question":"Which?","options":["A","B"]}') as post \gset
select is(parenting_post_detail(:'post')->'author'->>'child','Fixture child','post carries selected child identity');
select is(parenting_post_detail(:'post')->'author'->>'relationship','father','post carries family relationship');
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','like','on');
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','like','on');
select is((parenting_post_detail(:'post')->>'likes')::int,1,'like retry is idempotent');
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','vote','0');
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','vote','1');
select is((parenting_post_detail(:'post')->'poll'->>'total')::int,1,'changing vote does not duplicate voter');
select is((parenting_post_detail(:'post')->'poll'->>'mine')::int,1,'latest vote is selected');
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','comment','Nice story');
select is((parenting_post_detail(:'post')->>'comment_count')::int,1,'comment count matches actual comments');
select is(parenting_post_comments_page(:'post')->0->>'body','Nice story','comments are readable');
reset role;
insert into parenting_post_comments(post_id,user_id,body,author_identity) select :'post','a9670000-0000-4000-8000-000000000001','More comments', '{"family":"Fixture","child":"Fixture child","relationship":"father"}' from generate_series(1,35);
set local role authenticated;
select is(jsonb_array_length(parenting_post_comments_page(:'post')),30,'comment page is bounded');
select is(jsonb_array_length(parenting_post_comments_page(:'post',(parenting_post_comments_page(:'post')->29->>'created_at')::timestamptz,(parenting_post_comments_page(:'post')->29->>'id')::uuid)),6,'cursor gets remaining comments without skipping equal timestamps');
select throws_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Bad poll','Body',p_child=>'c9670000-0000-4000-8000-000000000001',p_poll=>' {"question":"Which?","options":["A","a"]}')$$,'22023','invalid poll','duplicate choices rejected');
select throws_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Impersonation','Body',p_child=>'c9670000-0000-4000-8000-000000000003')$$,'42501','forbidden','cannot impersonate another family child');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000003')),0::bigint,'other dong initially has no post');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select parenting_post_detail(%L)',:'post'),'42501','forbidden','different country cannot read shared post');
select throws_ok(format('select parenting_post_interact(%L,%L,%L,%L)',:'post','c9670000-0000-4000-8000-000000000004','comment','Cross country'),'42501','forbidden','different country cannot interact');
reset role;
select * from finish();rollback;
