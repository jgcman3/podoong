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
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Local only','Local body',p_child=>'c9670000-0000-4000-8000-000000000001') as local_post \gset
select is((select count(*) from parenting_feed('b9670000-0000-4000-8000-000000000001')),1::bigint,'neighborhood list includes only local posts by default');
select edit_parenting_post(:'local_post','health','Edited local','Edited body','{}','{}');
select is(parenting_post_detail(:'local_post')->>'title','Edited local','author can edit');
select is(parenting_post_detail(:'local_post')->>'audience','neighborhood','edit preserves audience');
reset role;
insert into parenting_post_photos(id,post_id,path,sort_order) values('d9800000-0000-4000-8000-000000000001',:'local_post','fixture/local-photo.webp',0);
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select parenting_post_detail(%L)',:'local_post'),'42501','forbidden','another dong cannot open local link');
select is((select count(*) from parenting_post_photos where post_id=:'local_post'),0::bigint,'another dong cannot read local photo metadata');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(parenting_post_detail(:'local_post')->>'title','Edited local','same dong can open local link');
select is((select count(*) from parenting_post_photos where post_id=:'local_post'),1::bigint,'same dong can read local photo metadata');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select delete_parenting_post(:'local_post');
select throws_ok(format('select parenting_post_detail(%L)',:'local_post'),'42501','forbidden','deleted post inaccessible');
reset role;
select * from finish();rollback;
