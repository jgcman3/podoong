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
insert into storage.objects(bucket_id,name,metadata,created_at)
select 'community-photos','a9670000-0000-4000-8000-000000000001/neighborhood/c9770000-0000-4000-8000-000000000001/d9770000-0000-4000-8000-000000000001'||suffix,
'{"mimetype":"image/webp","size":100}'::jsonb,now()-interval '2 days' from unnest(array['.webp','-480.webp']) suffix;
insert into children(id,family_id,name,birth_date,sex) values('c9670000-0000-4000-8000-000000000001','b9670000-0000-4000-8000-000000000001','Fixture child',current_date,'female');
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Photo post','Photo body','c9770000-0000-4000-8000-000000000001',array['d9770000-0000-4000-8000-000000000001']::uuid[],p_child=>'c9670000-0000-4000-8000-000000000001'),'c9770000-0000-4000-8000-000000000001'::uuid,'publish post with verified storage variants');
select is((select photo_ids from parenting_feed('b9670000-0000-4000-8000-000000000001')),array['d9770000-0000-4000-8000-000000000001']::uuid[],'feed returns ordered photo IDs');
select is((select count(*) from parenting_post_photos),1::bigint,'author can read photo metadata');
select throws_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Missing photo','Body','c9770000-0000-4000-8000-000000000002',array['d9770000-0000-4000-8000-000000000002']::uuid[],p_child=>'c9670000-0000-4000-8000-000000000001')$$,'22023','photo_missing','missing storage variant rejects post');
select throws_ok($$select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Duplicate','Body',gen_random_uuid(),array['d9770000-0000-4000-8000-000000000001','d9770000-0000-4000-8000-000000000001']::uuid[],p_child=>'c9670000-0000-4000-8000-000000000001')$$,'22023','invalid photos','duplicate photo IDs rejected');
reset role;
select is((select count(*) from neighborhood_posts where title='Missing photo'),0::bigint,'failed attachment publish rolls back text');
select queue_orphan_photos();
select is((select count(*) from community_photo_cleanup where path like '%c9770000-%'),0::bigint,'live photo and thumbnail excluded from orphan cleanup');
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_post_photos),1::bigint,'same-country member can read photo');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_post_photos),0::bigint,'different-country member cannot read photo');
reset role;
delete from neighborhood_posts where id='c9770000-0000-4000-8000-000000000001';
select is((select count(*) from parenting_post_photos),0::bigint,'post deletion removes photo metadata');
select is((select count(*) from community_photo_cleanup where path like '%c9770000-%'),2::bigint,'post deletion queues both variants for cleanup');
select * from finish();rollback;
