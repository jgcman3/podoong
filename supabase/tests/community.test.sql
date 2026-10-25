begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values ('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');
insert into profiles(id,display_name,consented_at) select id,'Community tester',now() from auth.users where id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003');
insert into community_moderators values ('a0000000-0000-4000-8000-000000000003');
insert into families(id,name,residence_country_code,residence_region_code,residence_city,residence_locality) values
('f0000000-0000-4000-8000-000000000001','Home','KR','1168010100','서울특별시 강남구','역삼동');
insert into family_members values
('f0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','owner'),
('f0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','viewer');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select community_command('post','b0000000-0000-4000-8000-000000000001','{"title":"Hello","body":"Public text","residenceVersion":0,"familyId":"f0000000-0000-4000-8000-000000000001","board":"topic:pregnancy"}')$$,'consented user creates post');
select lives_ok($$select community_command('comment','b0000000-0000-4000-8000-000000000004','{"postId":"b0000000-0000-4000-8000-000000000001","body":"Original comment"}')$$,'author comments on own post');
select throws_ok($$select community_command('hide','b0000000-0000-4000-8000-000000000001','{"kind":"post","reason":"test"}')$$,'42501','forbidden','ordinary user cannot moderate');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from community_posts),1,'participant sees post');
select throws_ok($$select community_command('delete-post','b0000000-0000-4000-8000-000000000001','{}')$$,'42501','forbidden','another author cannot delete');
select throws_ok($$select community_command('comment','b0000000-0000-4000-8000-000000000004','{"postId":"b0000000-0000-4000-8000-000000000001","body":"Stolen edit"}')$$,'42501','forbidden','another author cannot edit comment');
select is((select count(*)::int from moderation_actions),0,'ordinary participants cannot read moderation history');
select throws_ok($$insert into community_moderators values(auth.uid())$$,'42501',null,'direct moderator escalation denied');
select throws_ok($$insert into storage.objects(bucket_id,name) values('community-photos','a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000005')$$,'42501',null,'direct storage uploads cannot bypass validation');
select community_command('block','a0000000-0000-4000-8000-000000000001','{}');
select is((select count(*)::int from community_posts),0,'block hides author');
select is((select count(*)::int from community_comments),0,'block hides comments');
select throws_ok($$select community_command('comment','b0000000-0000-4000-8000-000000000002','{"postId":"b0000000-0000-4000-8000-000000000001","body":"x"}')$$,'42501','forbidden','blocked reader cannot reply to blocked author post');
-- The author still reads their own post; blocking a reader does not hide an author's own content.
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select community_command('hide','b0000000-0000-4000-8000-000000000001','{"kind":"post","reason":"policy"}');
select community_command('restrict','a0000000-0000-4000-8000-000000000001','{"reason":"policy","days":1}');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from community_posts),0,'hidden post disappears for its author too');
select is((select count(*)::int from community_comments),0,'hidden post also hides comments');
select ok(not community_photo_upload_allowed('a0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000005'),'restricted or hidden author cannot upload photo');
select throws_ok($$select community_command('post','b0000000-0000-4000-8000-000000000003','{"title":"x","body":"x","residenceVersion":0,"familyId":"f0000000-0000-4000-8000-000000000001","board":"topic:pregnancy"}')$$,'42501','restricted','restricted author cannot post');
select * from finish();
rollback;
