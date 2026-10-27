begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select has_function('public','growth_diary_history',array['uuid','uuid','integer'],'published growth history has an authorized endpoint');
select has_function('public','report_growth_diary',array['uuid','uuid','text'],'diary reporting has a persistence endpoint');
select has_table('public','growth_diary_shares','growth diary sharing is separate from private records');
select has_function('public','growth_diary_feed',array['uuid','text','integer','integer'],'feed limits fields by audience');
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','diary-owner@example.test'),
('00000000-0000-4000-8000-000000000002','diary-reader@example.test');
insert into public.profiles(id,display_name,consented_at) values
('00000000-0000-4000-8000-000000000001','Owner',now()),('00000000-0000-4000-8000-000000000002','Reader',now());
insert into public.families(id,name) values
('10000000-0000-4000-8000-000000000001','Owner'),('10000000-0000-4000-8000-000000000002','Reader');
insert into public.family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','owner');
insert into public.children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Private name','2026-01-01'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Same birthday','2026-01-01'),
('female','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Different year','2025-01-01');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_child_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-01-02T16:00:00Z","timezone":"Asia/Seoul","weight_kg":4.1,"height_cm":51,"head_cm":35,"note":"Shared diary"}',null);
select public.add_child_record_photo('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','image/png',100);
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000001','all')),0,'existing records stay private');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','growth','{"kind":"observation","occurred_at":"2026-01-02T16:00:00Z","timezone":"Asia/Seoul","note":"A diary without a title"}',null)$$,'growth diary saves without title');
select public.share_growth_diary('30000000-0000-4000-8000-000000000001',true,false,'female');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.child_records),0,'publishing never exposes private record rows');
select is((select count(*)::int from public.child_record_photos),0,'private photo metadata remains private');
select is((select weight_kg from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),4.1::numeric,'matching birthday sees weight');
select is((select height_cm from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),51::numeric,'matching birthday sees height');
select is((select head_cm from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),35::numeric,'matching birthday sees head circumference');
select is((select age_days from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),2,'D+ follows record local date');
select is((select nickname from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth',0,2)),'Private name','published diary includes child nickname');
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth',0,1)),0,'age navigation filters before pagination');
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth',0,2)),1,'matching age returns entry');
select throws_ok($$select public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth',0,-1)$$,'22023','invalid feed','negative age rejected');
select is((select sex from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),'female','sex is visible');
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000003','birth')),0,'same month and day in different year is not matched');
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','all')),0,'cohort sharing does not opt into everyone');
select ok(public.growth_diary_photo_allowed('30000000-0000-4000-8000-000000000001'),'matching child allows shared photo');
reset role;
insert into storage.objects(bucket_id,name) select 'child-care-photos',path from public.child_record_photos where id='40000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('storage.operation','storage.object.get_authenticated',true);
select is((select count(*)::int from storage.objects where bucket_id='child-care-photos'),1,'cohort member can download shared photo');
select set_config('storage.operation','storage.object.sign',true);
select is((select count(*)::int from storage.objects where bucket_id='child-care-photos'),0,'cohort member cannot mint signed URLs that outlive revocation');
select set_config('storage.operation','storage.object.sign_many',true);
select is((select count(*)::int from storage.objects where bucket_id='child-care-photos'),0,'batch signing is also denied');

select throws_ok($$select public.growth_diary_feed('20000000-0000-4000-8000-000000000001','birth')$$,'42501','forbidden','cannot spoof another family child');
select throws_ok($$select public.share_growth_diary('30000000-0000-4000-8000-000000000001',true,true,'male')$$,'42501','forbidden','reader cannot change publication');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.share_growth_diary('30000000-0000-4000-8000-000000000001',true,true,'female');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000003','all')),1,'everyone feed ignores birthday');
select ok((select weight_kg is null and height_cm is null and head_cm is null from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','all')),'everyone projection never returns measurements even for matching child');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_child_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-01-02T01:00:00Z","timezone":"Asia/Seoul","weight_kg":3,"height_cm":50}',null);
select public.save_child_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-01-03T01:00:00Z","timezone":"Asia/Seoul","weight_kg":9}',null);
select public.share_growth_diary('30000000-0000-4000-8000-000000000003',true,false,'female');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.growth_diary_history('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001')),2,'history includes all shared measurements across ages, not private measurements');
select is((select string_agg(age_days::text,',' order by age_days) from public.growth_diary_history('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001')),'1,2','history uses D+ values');
select throws_ok($$select public.growth_diary_history('20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001')$$,'42501','forbidden','different birthday cannot read measurements via everyone sharing');
select throws_ok($$select public.growth_diary_history('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004')$$,'42501','forbidden','private record cannot be a history anchor');
select lives_ok($$select public.report_growth_diary('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Privacy concern')$$,'reader submits report');
select public.report_growth_diary('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Repeated report');
select is((select count(*)::int from public.community_reports where diary_record_id='30000000-0000-4000-8000-000000000001'),1,'repeat submission does not duplicate open reports');
select is((select diary_note from public.community_reports where diary_record_id='30000000-0000-4000-8000-000000000001'),'Shared diary','report retains submitted content for moderation');
select throws_ok($$select public.report_growth_diary('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',' ')$$,'22023','invalid reason','empty report reason rejected');
select throws_ok($$select public.moderate_growth_diary('30000000-0000-4000-8000-000000000001',true,'Reason')$$,'42501','forbidden','ordinary reader cannot moderate');
reset role;
insert into public.community_moderators values('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.moderate_growth_diary('30000000-0000-4000-8000-000000000001',true,'Review');
select ok(not public.growth_diary_photo_allowed('30000000-0000-4000-8000-000000000001'),'moderation hides photos');
select is((select count(*)::int from public.growth_diary_history('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003')),1,'hidden measurements disappear from another visible diary history');
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','all')),0,'moderation hides public feed entry');
select public.moderate_growth_diary('30000000-0000-4000-8000-000000000001',false,'Reviewed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.delete_child_record('30000000-0000-4000-8000-000000000003');
select public.delete_child_record('30000000-0000-4000-8000-000000000004');
select public.share_growth_diary('30000000-0000-4000-8000-000000000001',false,false,'female');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.growth_diary_feed('20000000-0000-4000-8000-000000000002','birth')),0,'revocation removes feed entry');
select is((select count(*)::int from public.growth_diary_photo('40000000-0000-4000-8000-000000000001')),0,'revocation removes photo access');
reset role;
set local role anon;
select throws_ok($$select public.growth_diary_feed('20000000-0000-4000-8000-000000000002','all')$$,'42501',null,'anonymous cannot read diary feed');
reset role;
select * from finish();
rollback;
