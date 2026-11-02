begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a9690000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4)i;
insert into profiles(id,display_name,consented_at) select id,'Fixture',now() from auth.users where id::text like 'a9690000-%';
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9690000-0000-4000-8000-000000000001','Fixture','KR','서울특별시 강남구','역삼동'),
('b9690000-0000-4000-8000-000000000002','Fixture','KR','서울특별시 강남구','논현동'),
('b9690000-0000-4000-8000-000000000003','Fixture','KR','부산광역시 중구','중앙동');
insert into family_members(family_id,user_id,role,relationship) select ('b9690000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a9690000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'owner','father' from generate_series(1,3)i;
insert into family_members(family_id,user_id,role,relationship) values('b9690000-0000-4000-8000-000000000001','a9690000-0000-4000-8000-000000000004','viewer','mother');
insert into children(id,family_id,name,sex,birth_date) select ('c9690000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b9690000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Private child',case when i=2 then 'male' else 'female' end,current_date-100 from generate_series(1,3)i;
insert into parenting_friend_profiles(child_id,nickname,status,enabled) values
('c9690000-0000-4000-8000-000000000002','Neighbor','Hello',true),
('c9690000-0000-4000-8000-000000000003','Other city','Hi',true);
select set_config('request.jwt.claims','{"sub":"a9690000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from parenting_friends('b9690000-0000-4000-8000-000000000001')),1::bigint,'no family child is automatically published');
select lives_ok($$select save_parenting_friend('c9690000-0000-4000-8000-000000000001','Our public nickname','Looking for friends',true)$$,'owner can explicitly publish a child introduction');
select is((select count(*) from parenting_friends('b9690000-0000-4000-8000-000000000001')),2::bigint,'default district includes both neighborhoods');
select is((select count(*) from parenting_friends('b9690000-0000-4000-8000-000000000001','locality')),1::bigint,'locality narrows the friend list');
select is((select count(*) from parenting_friends('b9690000-0000-4000-8000-000000000001','all')),3::bigint,'all areas includes opt-in friends from another city');
select is((select count(*) from parenting_friend_profiles),1::bigint,'direct table access cannot expose other family profiles or child IDs');
select ok((select bool_and(age_days between 100 and 101) from parenting_friends('b9690000-0000-4000-8000-000000000001')),'feed returns age in days rather than birth dates');
select throws_ok($$select save_parenting_friend('c9690000-0000-4000-8000-000000000002','Attack','No',true)$$,'42501','forbidden','cannot change another child profile');
select throws_ok($$select parenting_friends('b9690000-0000-4000-8000-000000000002')$$,'42501','forbidden','cannot read through another family');
select throws_ok($$select save_parenting_friend('c9690000-0000-4000-8000-000000000001','Name',E'two\nlines',true)$$,'22023','invalid profile','status must be a short single line');
select lives_ok($$select save_parenting_post('b9690000-0000-4000-8000-000000000001','pediatrics','Clinic','Question')$$,'pediatrics posts accept the new tag');
select lives_ok($$select save_parenting_post('b9690000-0000-4000-8000-000000000001','travel','Travel','Question')$$,'travel posts accept the new tag');
select is((select count(*) from parenting_feed('b9690000-0000-4000-8000-000000000001','all','travel')),1::bigint,'post appears in its chosen tag category');
select lives_ok($$select save_parenting_friend('c9690000-0000-4000-8000-000000000001','Our public nickname','Looking for friends',false)$$,'owner can stop publication');
select is((select count(*) from parenting_friends('b9690000-0000-4000-8000-000000000001')),1::bigint,'unpublishing removes the card immediately');
reset role;
select set_config('request.jwt.claims','{"sub":"a9690000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select save_parenting_friend('c9690000-0000-4000-8000-000000000001','Attack','No',true)$$,'42501','forbidden','a non-owner caregiver cannot publish child information');
reset role;
set local role anon;
select throws_ok($$select parenting_friends('b9690000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot see friend introductions');
select throws_ok($$select * from parenting_friend_profiles$$,'42501',null,'anonymous visitors cannot read raw child profile rows');
reset role;
delete from children where id='c9690000-0000-4000-8000-000000000002';
select is((select count(*) from parenting_friend_profiles where child_id='c9690000-0000-4000-8000-000000000002'),0::bigint,'child deletion also removes its public introduction');
select * from finish();
rollback;
