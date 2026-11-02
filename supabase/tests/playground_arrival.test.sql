begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('a9710000-0000-4000-8000-000000000001'),('a9710000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) values('a9710000-0000-4000-8000-000000000001','Owner',now()),('a9710000-0000-4000-8000-000000000002','Other',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9710000-0000-4000-8000-000000000001','포둥네','KR','서울특별시 강남구','역삼동'),('b9710000-0000-4000-8000-000000000002','Other','KR','서울특별시 강남구','논현동');
insert into family_members(family_id,user_id,role,relationship) values('b9710000-0000-4000-8000-000000000001','a9710000-0000-4000-8000-000000000001','owner','mother'),('b9710000-0000-4000-8000-000000000002','a9710000-0000-4000-8000-000000000002','owner','father');
insert into children(id,family_id,name,sex,birth_date) values
('c9710000-0000-4000-8000-000000000001','b9710000-0000-4000-8000-000000000001','지혜','female',current_date-180),
('c9710000-0000-4000-8000-000000000002','b9710000-0000-4000-8000-000000000001','동생','male',current_date-90),
('c9710000-0000-4000-8000-000000000003','b9710000-0000-4000-8000-000000000001','미접속','female',current_date-300),
('c9710000-0000-4000-8000-000000000004','b9710000-0000-4000-8000-000000000002','Other child','male',current_date-400);
insert into parenting_friend_profiles(child_id,nickname,status) select id,'Ignored nickname','Hello' from children where id::text like 'c9710000-%';
select set_config('request.jwt.claims','{"sub":"a9710000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.parenting_playground('c9710000-0000-4000-8000-000000000001') as first \gset
select is(:'first'::jsonb->>'population','1','only a child that visits is counted');
select is(:'first'::jsonb->'own'->>'nickname','포둥네 지혜','display name is composed automatically');
select is(jsonb_array_length(:'first'::jsonb->'members'),0,'registered but absent children do not appear');
select public.parenting_playground('c9710000-0000-4000-8000-000000000002') as second \gset
select is(:'second'::jsonb->>'population','2','new arrival is added immediately');
select public.parenting_playground('c9710000-0000-4000-8000-000000000001') as returned \gset
select is(:'returned'::jsonb->'own'->'x',:'first'::jsonb->'own'->'x','new arrivals never shift existing x');
select is(:'returned'::jsonb->'own'->'y',:'first'::jsonb->'own'->'y','refresh preserves the daily depth');
select is(jsonb_array_length(:'returned'::jsonb->'members'),1,'a visiting published neighbor appears');
select ok(abs((:'second'::jsonb->'own'->>'x')::integer-(:'first'::jsonb->'own'->>'x')::integer)<300,'new child is placed near the first child');
select lives_ok($$select save_parenting_friend('c9710000-0000-4000-8000-000000000001','New status')$$,'status-only save preserves the generated name');
select is(public.parenting_playground('c9710000-0000-4000-8000-000000000001')->'own'->>'nickname','포둥네 지혜','public name stays derived from family and child');
select throws_ok($$select parenting_playground('c9710000-0000-4000-8000-000000000004')$$,'42501','forbidden','cannot register another family child');
select throws_ok($$select parenting_playground('c9710000-0000-4000-8000-000000000001',0,5000,'2026-11-02')$$,'22023','invalid viewport','reject unbounded viewport requests');
select throws_ok($$select * from parenting_playground_positions$$,'42501',null,'raw child coordinates are not exposed');
reset role;
select is((select count(*) from parenting_playground_positions where child_id='c9710000-0000-4000-8000-000000000001'),1::bigint,'one coordinate per child and local day');
select is((select count(*) from cron.job where jobname='podoong-playground-midnight'),0::bigint,'no recurring playground job is installed');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='parenting_friend_profiles' and column_name='enabled'),0::bigint,'no public/private setting is stored');
update families set name='새 가족' where id='b9710000-0000-4000-8000-000000000001';
set local role authenticated;
select public.parenting_playground('c9710000-0000-4000-8000-000000000001') as changed \gset
select is(jsonb_array_length(:'changed'::jsonb->'members'),1,'visiting neighbors remain visible after a status update');
select is(:'changed'::jsonb->'own'->>'nickname','새 가족 지혜','renaming the family updates display names without manual sync');
select is(:'changed'::jsonb->'own'->'x',:'first'::jsonb->'own'->'x','name changes do not move the child');
reset role;
insert into parenting_playground_positions(region_id,day,child_id,slot,x,y) select region_id,day-1,'c9710000-0000-4000-8000-000000000003',999,9999,9999 from parenting_playground_positions where child_id='c9710000-0000-4000-8000-000000000001';
delete from parenting_friend_profiles where child_id='c9710000-0000-4000-8000-000000000003';
set local role authenticated;
select public.parenting_playground('c9710000-0000-4000-8000-000000000003') as third \gset
select is(jsonb_array_length(public.parenting_playground('c9710000-0000-4000-8000-000000000001')->'members'),2,'arrivals without an introduction also appear');
select ok((:'third'::jsonb->'own'->>'x')::integer<>9999,'a new day creates a fresh placement lazily');
reset role;
select is((select count(*) from parenting_playground_positions where child_id='c9710000-0000-4000-8000-000000000003'),2::bigint,'day-scoped rows keep current positions independent');
set local role anon;
select throws_ok($$select parenting_playground('c9710000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous visitors cannot enter a child room');
reset role;
select * from finish();rollback;
