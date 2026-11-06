begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a9970000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4)i;
insert into profiles(id,display_name,consented_at) select id,'Report fixture',now() from auth.users where id::text like 'a9970000-%';
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9970000-0000-4000-8000-000000000001','Author','KR','서울특별시 강남구','역삼동'),
('b9970000-0000-4000-8000-000000000002','Reporter','KR','서울특별시 강남구','역삼동'),
('b9970000-0000-4000-8000-000000000003','Elsewhere','KR','서울특별시 강남구','논현동');
insert into family_members(family_id,user_id,role,relationship) select ('b9970000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a9970000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'owner','father' from generate_series(1,3)i;
insert into children(id,family_id,name,sex,birth_date) values
('c9970000-0000-4000-8000-000000000001','b9970000-0000-4000-8000-000000000001','Public child','female',current_date-100),
('c9970000-0000-4000-8000-000000000002','b9970000-0000-4000-8000-000000000002','Different birth date','male',current_date-200);
insert into public.signup_agreements(user_id,kind,version,interface_locale) select p.id,d.kind,d.version,'ko' from public.profiles p cross join public.signup_document_versions d where p.id::text like 'a9970000-%' and d.is_current on conflict do nothing;
insert into public.signup_privacy_choices(user_id,version,locale,child_information,authority,health,public_sharing,neighborhood) select id,public.current_signup_privacy_version(),'ko',true,true,true,true,true from profiles where id::text like 'a9970000-%';
insert into child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood) select k.id,m.user_id,public.current_signup_privacy_version(),true,true,true,true,true from children k join family_members m on m.family_id=k.family_id where k.id::text like 'c9970000-%';
insert into neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,audience) values
('d9970000-0000-4000-8000-000000000001','fixture','boards','b9970000-0000-4000-8000-000000000001','a9970000-0000-4000-8000-000000000001','Neighborhood fixture','Original public content','daily','neighborhood'),
('d9970000-0000-4000-8000-000000000002','fixture','boards','b9970000-0000-4000-8000-000000000001','a9970000-0000-4000-8000-000000000001','Local fixture','Local content','local-daily','neighborhood');
insert into parenting_post_photos(id,post_id,path,sort_order) values('f9970000-0000-4000-8000-000000000001','d9970000-0000-4000-8000-000000000001','fixture/report.webp',0);
insert into child_records(id,child_id,service,kind,note,occurred_at,record_timezone,created_by,updated_by) values
('e9970000-0000-4000-8000-000000000001','c9970000-0000-4000-8000-000000000001','growth','observation','Diary snapshot',now(),'UTC','a9970000-0000-4000-8000-000000000001','a9970000-0000-4000-8000-000000000001');
insert into growth_diary_shares(record_id,everyone,same_birth_date,published_by) values('e9970000-0000-4000-8000-000000000001',true,false,'a9970000-0000-4000-8000-000000000001');
insert into service_admins(user_id) values('a9970000-0000-4000-8000-000000000004');
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select report_parenting_post('d9970000-0000-4000-8000-000000000002','Out of area')$$,'42501','forbidden','cannot report a neighborhood post one cannot read');
select throws_ok($$select admin_reports()$$,'42501','forbidden','ordinary user cannot inspect reports');
reset role;
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select report_parenting_post('d9970000-0000-4000-8000-000000000001','Own')$$,'42501','forbidden','author cannot report own post');
select is((select count(*) from community_reports),0::bigint,'author cannot see someone else reporting');
reset role;
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select report_parenting_post('d9970000-0000-4000-8000-000000000001','   ')$$,'22023','invalid reason','empty reasons are rejected');
select report_parenting_post('d9970000-0000-4000-8000-000000000001','Spam');
select report_parenting_post('d9970000-0000-4000-8000-000000000001','Duplicate');
select report_parenting_post('d9970000-0000-4000-8000-000000000002','Privacy');
select report_growth_diary('c9970000-0000-4000-8000-000000000002','e9970000-0000-4000-8000-000000000001','Diary report');
select is((select count(*) from community_reports),3::bigint,'one open report per user/content including different-birthday public diary');
select id as report from community_reports where parenting_post_id='d9970000-0000-4000-8000-000000000001' \gset
select id as diary from community_reports where diary_record_id='e9970000-0000-4000-8000-000000000001' \gset
select throws_ok(format('select admin_review_report(%L,%L,%L,0,false)',:'report','hide','Unauthorized'),'42501','forbidden','browser cannot moderate reports');
reset role;
update neighborhood_posts set body='Edited content' where id='d9970000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from community_reports),0::bigint,'author cannot read the reporter identity or reason');
reset role;
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from admin_reports()),3::bigint,'service admin sees neighborhood posts and diary together');
select is((select body from admin_reports() where id=:'report'),'Original public content','report captures content before later edits');
select is((select count(distinct kind) from admin_reports()),2::bigint,'source labels distinguish neighborhood and diary');
select admin_review_report(:'report','hide','Policy violation',0,false);
select is((select hidden from admin_reports() where id=:'report'),true,'admin can hide a reported post');
select throws_ok(format('select admin_review_report(%L,%L,%L,0,false)',:'report','resolve','Stale review'),'40001','conflict','stale report versions are rejected');
select throws_ok(format('select admin_review_report(%L,%L,%L,1,false)',:'report','unhide','Stale visibility'),'40001','conflict','stale subject visibility is rejected');
reset role;
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select ok(not parenting_post_visible('d9970000-0000-4000-8000-000000000001'),'hidden content is unreadable');
select is((select count(*) from parenting_feed('b9970000-0000-4000-8000-000000000002') where id='d9970000-0000-4000-8000-000000000001'),0::bigint,'hidden neighborhood post is absent from feed');
select throws_ok($$select parenting_post_detail('d9970000-0000-4000-8000-000000000001')$$,'42501','forbidden','hidden detail is blocked');
select throws_ok($$select parenting_post_interact('d9970000-0000-4000-8000-000000000001','c9970000-0000-4000-8000-000000000002','like','true')$$,'42501','forbidden','hidden post cannot be liked or commented on');
select is((select count(*) from parenting_post_photos where post_id='d9970000-0000-4000-8000-000000000001'),0::bigint,'hidden photo paths are blocked by RLS');
reset role;
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select admin_review_report(:'report','resolve','Reviewed',1,true);
select is((select count(*) from admin_reports()),2::bigint,'resolved report leaves the open queue');
select is((select count(*) from admin_reports('resolved')),1::bigint,'resolved reports remain reviewable');
select admin_review_report(:'report','unhide','Restored',2,true);
select admin_review_report(:'report','reopen','Review again',3,false);
select is((select version from admin_reports() where id=:'report'),4,'review and status changes advance the version');
select admin_review_report(:'diary','hide','Diary policy',0,false);
reset role;
select is((select note from child_records where id='e9970000-0000-4000-8000-000000000001'),'Diary snapshot','hiding a diary preserves the family original');
select is((select count(*) from admin_audit_log where action like 'report_%' and actor_id='a9970000-0000-4000-8000-000000000004'),5::bigint,'each successful moderation action is audited');
select set_config('request.jwt.claims','{"sub":"a9970000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select ok(not growth_diary_photo_allowed('e9970000-0000-4000-8000-000000000001'),'hidden diary photos are no longer public');
select ok(parenting_post_visible('d9970000-0000-4000-8000-000000000001'),'restored post can be read again');
reset role;
delete from neighborhood_posts where id='d9970000-0000-4000-8000-000000000001';
select is((select count(*) from community_reports where id=:'report'),0::bigint,'deleting source content also removes its report snapshot');
select * from finish();rollback;
