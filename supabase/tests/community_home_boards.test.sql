begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6) n;
insert into profiles(id,display_name,consented_at) select id,'Board tester',now() from auth.users where id::text like 'a1000000-%';
insert into residence_countries(code,name,enabled) values('US','Test country',true);
insert into residence_regions(country_code,code,city_name,locality_name,community_scope) values('US','test-area','Test city','Test neighborhood','locality');
insert into families(id,name,residence_country_code,residence_region_code,residence_city,residence_locality) values
('f1000000-0000-4000-8000-000000000001','역삼','KR','1168010100','서울특별시 강남구','역삼동'),
('f1000000-0000-4000-8000-000000000002','대치','KR','1168010600','서울특별시 강남구','대치동'),
('f1000000-0000-4000-8000-000000000003','송파','KR','1171010100','서울특별시 송파구','잠실동'),
('f1000000-0000-4000-8000-000000000004','다른 국가','US','test-area','Test city','Test neighborhood'),
('f1000000-0000-4000-8000-000000000005','미등록',null,null,null,null);
insert into family_members select ('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'owner' from generate_series(1,5) n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from community_board_locations()),3,'home provides district, locality and national scopes');
select lives_ok($$select community_command('post','b1000000-0000-4000-8000-000000000001','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000001","board":"locality","title":"Local","body":"Neighborhood"}')$$,'neighborhood post is created from registered home');
select lives_ok($$select community_command('post','b1000000-0000-4000-8000-000000000002','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000001","board":"district","title":"District","body":"District"}')$$,'district post is created');
select lives_ok($$select community_command('post','b1000000-0000-4000-8000-000000000003','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000001","board":"topic:feeding","title":"National","body":"Country"}')$$,'national topic post is created');
select is((select b.region_code from community_posts p join community_boards b on b.id=p.board_id where p.id='b1000000-0000-4000-8000-000000000001'),'1168010100','local board uses full canonical locality key');
select is((select b.region_label from community_posts p join community_boards b on b.id=p.board_id where p.id='b1000000-0000-4000-8000-000000000002'),'서울특별시 강남구','district title includes full region');
select lives_ok($$select community_command('post','b1000000-0000-4000-8000-000000000001','{"board":"district","title":"Edited local","body":"Still local"}')$$,'editing changes text');
select is((select b.scope from community_posts p join community_boards b on b.id=p.board_id where p.id='b1000000-0000-4000-8000-000000000001'),'locality','editing cannot relocate existing conversation');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from community_posts where id::text like 'b1000000-%'),2,'same district but different neighborhood sees district and national posts');
select throws_ok($$select community_command('comment','c1000000-0000-4000-8000-000000000001','{"postId":"b1000000-0000-4000-8000-000000000001","body":"Forged reply"}')$$,'42501','forbidden','other neighborhood cannot comment by guessing post id');
select throws_ok($$select community_command('bookmark','b1000000-0000-4000-8000-000000000001','{}')$$,'42501','forbidden','other neighborhood cannot bookmark hidden local post');
select throws_ok($$select community_command('post','b1000000-0000-4000-8000-000000000004','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000001","board":"locality","title":"Forged","body":"Other family"}')$$,'42501','residence required','cannot impersonate a family to choose its neighborhood');
select lives_ok($$select community_command('comment','c1000000-0000-4000-8000-000000000002','{"postId":"b1000000-0000-4000-8000-000000000002","body":"Same district"}')$$,'same district can comment on district post');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from community_posts where id::text like 'b1000000-%'),1,'other district in same country sees only national topic');
select is((select count(*)::int from community_comments where id::text like 'c1000000-%'),0,'comments inherit the board boundary');
select lives_ok($$select community_command('comment','c1000000-0000-4000-8000-000000000003','{"postId":"b1000000-0000-4000-8000-000000000003","body":"Same country"}')$$,'other district can join national topic discussion');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from community_posts where id::text like 'b1000000-%'),0,'other country cannot read Korean national or regional posts');
select lives_ok($$select community_command('post','b1000000-0000-4000-8000-000000000005','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000004","board":"topic:feeding","title":"Other country","body":"National"}')$$,'same topic gets a separate board in another country');
select is((select b.country_code from community_posts p join community_boards b on b.id=p.board_id where p.id='b1000000-0000-4000-8000-000000000005'),'US','country is resolved server-side from family');
select throws_ok($$select community_command('comment','c1000000-0000-4000-8000-000000000004','{"postId":"b1000000-0000-4000-8000-000000000003","body":"Different country"}')$$,'42501','forbidden','different country cannot reply');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select is((select count(*)::int from community_board_locations()),0,'unset home does not guess a country or neighborhood');
select throws_ok($$select community_command('post','b1000000-0000-4000-8000-000000000006','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000005","board":"topic:daily","title":"Unknown home","body":"Unknown"}')$$,'42501','residence required','home is required before posting');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select save_family_residence_region('f1000000-0000-4000-8000-000000000001','1171010100',0)$$,'owner moves to another district');
select is((select count(*)::int from community_posts where id in ('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002')),0,'moving home revokes old regional thread access');
select is((select count(*)::int from community_posts where id='b1000000-0000-4000-8000-000000000003'),1,'national topic remains accessible after same-country move');
select throws_ok($$select community_command('post','b1000000-0000-4000-8000-000000000001','{"title":"Moved","body":"Cannot move thread"}')$$,'42501','forbidden','moving does not carry old regional conversation into a new board');
select throws_ok($$select community_command('post','b1000000-0000-4000-8000-000000000007','{"residenceVersion":0,"familyId":"f1000000-0000-4000-8000-000000000001","board":"district","title":"Stale compose","body":"Intended for old district"}')$$,'P0001','conflict','a stale composer cannot silently publish to the new address');
select * from finish();
rollback;
