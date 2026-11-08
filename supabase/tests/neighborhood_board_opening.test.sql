begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('a9810000-0000-4000-8000-000000000001'),('a9810000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) values('a9810000-0000-4000-8000-000000000001','Owner',now()),('a9810000-0000-4000-8000-000000000002','Other',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9810000-0000-4000-8000-000000000001','포둥네','KR','개방검증시','역삼동'),('b9810000-0000-4000-8000-000000000002','Other','KR','개방검증시','역삼동');
insert into family_members(family_id,user_id,role,relationship) values('b9810000-0000-4000-8000-000000000001','a9810000-0000-4000-8000-000000000001','owner','mother'),('b9810000-0000-4000-8000-000000000002','a9810000-0000-4000-8000-000000000002','owner','father');
insert into children(id,family_id,name,sex,birth_date) values
('c9810000-0000-4000-8000-000000000001','b9810000-0000-4000-8000-000000000001','지혜','female',current_date-180),
('c9810000-0000-4000-8000-000000000002','b9810000-0000-4000-8000-000000000001','동생','male',current_date-90),
('c9810000-0000-4000-8000-000000000003','b9810000-0000-4000-8000-000000000001','미접속','female',current_date-300),
('c9810000-0000-4000-8000-000000000004','b9810000-0000-4000-8000-000000000002','Other child','male',current_date-400);

select set_config('request.jwt.claims','{"sub":"a9810000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'families','2','siblings count as one family');
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'open','false','two families cannot open the board');
select throws_ok($$select neighborhood_board_status('b9810000-0000-4000-8000-000000000002')$$,'42501','forbidden','cannot inspect another family');
select throws_ok($$select neighborhood_family_count('b9810000-0000-4000-8000-000000000001')$$,'42501',null,'internal counting function is private');
select is((select count(*)::integer from parenting_feed('b9810000-0000-4000-8000-000000000001')),0,'feed is closed server side');
reset role;
select throws_ok($$insert into neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality,audience) values('d9810000-0000-4000-8000-000000000001','test','boards','b9810000-0000-4000-8000-000000000001','a9810000-0000-4000-8000-000000000001','Hello','Hello neighbors','local-daily','KR','개방검증시','개방검증시','역삼동','neighborhood')$$,'42501','neighborhood_not_open','direct post creation is closed');
insert into auth.users(id) values('a9810000-0000-4000-8000-000000000003');
insert into profiles(id,display_name,consented_at) values('a9810000-0000-4000-8000-000000000003','Third',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values('b9810000-0000-4000-8000-000000000003','Third','KR','개방검증시','다른동');
insert into family_members(family_id,user_id,role) values('b9810000-0000-4000-8000-000000000003','a9810000-0000-4000-8000-000000000003','owner');
select set_config('request.jwt.claims','{}',true);
insert into children(id,family_id,name,sex,birth_date) values('c9810000-0000-4000-8000-000000000005','b9810000-0000-4000-8000-000000000003','Third child','male',current_date-90);
select is(neighborhood_family_count('b9810000-0000-4000-8000-000000000001'),2,'another neighborhood does not count');
select set_config('request.jwt.claims','{"sub":"a9810000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update families set residence_locality='역삼동' where id='b9810000-0000-4000-8000-000000000003';
set local role authenticated;
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'open','true','third distinct family opens the board');
reset role;
insert into neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality,audience) values('d9810000-0000-4000-8000-000000000001','test','boards','b9810000-0000-4000-8000-000000000001','a9810000-0000-4000-8000-000000000001','Hello','Hello neighbors','local-daily','KR','개방검증시','개방검증시','역삼동','neighborhood');
set local role authenticated;
select is(parenting_post_visible('d9810000-0000-4000-8000-000000000001'),true,'post can be read after opening');
reset role;
update families set residence_locality='다른동' where id='b9810000-0000-4000-8000-000000000003';
set local role authenticated;
select is(parenting_post_visible('d9810000-0000-4000-8000-000000000001'),false,'direct links close below three families');
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'open','false','board closes when fewer than three families remain');
select is(jsonb_array_length(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->'founders'),3,'opening keeps all three founding family names');
reset role;
update families set name='New third family' where id='b9810000-0000-4000-8000-000000000003';
select is((select count(*)::integer from neighborhood_posts where id='d9810000-0000-4000-8000-000000000001'),1,'closing preserves existing posts');
update families set residence_locality='역삼동' where id='b9810000-0000-4000-8000-000000000003';
set local role authenticated;
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'open','true','third family returning reopens the board');
select is(parenting_post_visible('d9810000-0000-4000-8000-000000000001'),true,'existing posts become readable again');
select is(jsonb_array_length(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->'founders'),3,'reopening does not duplicate the original announcement');
reset role;
set local role authenticated;
select is(neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->>'reopened','true','reopening is identified');
select ok((neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->'founders') ? 'New third family','reopening replaces the saved names');
reset role;
-- No page visit while closed: a departure still records the transition.
update families set residence_locality='다른동' where id='b9810000-0000-4000-8000-000000000003';
update families set residence_locality='역삼동',name='Returned family' where id='b9810000-0000-4000-8000-000000000003';
set local role authenticated;
select ok((neighborhood_board_status('b9810000-0000-4000-8000-000000000001')->'founders') ? 'Returned family','refreshes names even without a visit during closure');
reset role;
select * from finish();
rollback;
