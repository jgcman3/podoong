begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','owner@example.test'),
('00000000-0000-4000-8000-000000000002','viewer@example.test'),
('00000000-0000-4000-8000-000000000003','editor@example.test'),
('00000000-0000-4000-8000-000000000004','stranger@example.test');
insert into public.profiles(id,display_name,consented_at) select id,'Test',now() from auth.users
where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');
insert into public.families(id,name) values('10000000-0000-4000-8000-000000000001','Test');
insert into public.family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','editor');
insert into public.children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-09-01'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-09-01');
insert into public.child_access values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','editor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','sleep','{"kind":"nap","occurred_at":"2026-10-13T23:30:00Z","ended_at":"2026-10-14T01:00:00Z","timezone":"Asia/Seoul"}',null)$$,'owner saves midnight-crossing sleep');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','sleep','{"kind":"nap","occurred_at":"2026-10-13T23:30:00Z","ended_at":"2026-10-14T01:00:00Z","timezone":"Asia/Seoul"}',null)$$,'sleep retry is idempotent');
select is((select count(*)::int from public.child_records),1,'retry does not duplicate');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','sleep','{"kind":"night","occurred_at":"2026-10-14T00:00:00Z","ended_at":"2026-10-14T02:00:00Z","timezone":"Asia/Seoul"}',null)$$,'23P01',null,'overlapping completed sleep is rejected');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','sleep','{"kind":"nap","occurred_at":"2026-10-14T03:00:00Z","ended_at":"2026-10-14T02:00:00Z","timezone":"Asia/Seoul"}',null)$$,'23514',null,'backwards sleep rejected');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','sleep','{"kind":"night","occurred_at":"2026-10-14T03:00:00Z","timezone":"Asia/Seoul"}',null)$$,'active sleep timer saves');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','sleep','{"kind":"nap","occurred_at":"2026-10-14T04:00:00Z","timezone":"Asia/Seoul"}',null)$$,'23505',null,'second active timer rejected');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','diaper','{"kind":"mixed","occurred_at":"2026-10-14T01:00:00Z","stool_color":"brown","stool_texture":"soft","note":"changed","timezone":"Asia/Seoul"}',null)$$,'diaper observations save');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-10-14T01:00:00Z","weight_kg":6.25,"height_cm":63,"timezone":"Asia/Seoul"}',null)$$,'growth measurements save with explicit units');
select is((select head_cm::text from public.child_records where id='30000000-0000-4000-8000-000000000004'),null,'unmeasured value stays null');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-10-14T01:00:00Z","timezone":"Asia/Seoul"}',null)$$,'23514',null,'empty measurement rejected');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','growth','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","title":"Rolled over","note":"diary","timezone":"Asia/Seoul"}',null)$$,'development diary saves');
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','growth','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","title":"Updated diary","timezone":"Asia/Seoul"}',1)$$,'versioned update succeeds');
select throws_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','growth','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","title":"Stale","timezone":"Asia/Seoul"}',1)$$,'P0001','conflict','stale caregiver update rejected');
select throws_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','growth','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","title":"Move","timezone":"Asia/Seoul"}',2)$$,'42501','forbidden','record cannot be moved to another child');
select lives_ok($$select public.add_child_record_photo('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','image/png',100)$$,'growth photo registration is scoped');
select ok(public.child_photo_access((select path from public.child_record_photos limit 1),true),'uploader can upload');
select throws_ok($$select public.add_child_record_photo(gen_random_uuid(),'30000000-0000-4000-8000-000000000003','image/png',100)$$,'42501','forbidden','photos only attach to growth records');
select throws_ok($$select public.add_child_record_photo(gen_random_uuid(),'30000000-0000-4000-8000-000000000005','image/svg+xml',100)$$,'23514',null,'unsafe image type rejected');
select is((public.export_child_data('20000000-0000-4000-8000-000000000001')->>'format_version')::int,4,'export includes extended records');
select is(jsonb_array_length(public.export_child_data('20000000-0000-4000-8000-000000000001')->'child_records'),5,'export contains all service records');
select ok(not ((public.export_child_data('20000000-0000-4000-8000-000000000001')->'child_records'->0) ? 'created_by'),'export removes caregiver identifiers');
select ok(not ((public.export_child_data('20000000-0000-4000-8000-000000000001')->'child_photos'->0) ? 'path'),'export omits uploader-bearing storage paths');
select throws_ok($$insert into public.child_records(id,child_id,service,kind,occurred_at,record_timezone) values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','diaper','wet',now(),'UTC')$$,'42501',null,'direct unaudited writes denied');
select is(public.child_record_day_count('20000000-0000-4000-8000-000000000001','sleep','2026-10-14','Asia/Seoul'),2,'local date counts include midnight-crossing sleep starts');
select is(public.child_record_day_count('20000000-0000-4000-8000-000000000001','sleep','2026-10-13','UTC'),1,'UTC dates keep their own boundary');
select public.add_child_record_photo('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000005','image/png',100);
select public.add_child_record_photo('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005','image/png',100);
select public.add_child_record_photo('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000005','image/png',100);
select lives_ok($$select public.add_child_record_photo(gen_random_uuid(),'30000000-0000-4000-8000-000000000005','image/png',100)$$,'fifth photo accepted');
select public.add_child_record_photo(gen_random_uuid(),'30000000-0000-4000-8000-000000000005','image/png',100) from generate_series(1,4);
select throws_ok($$select public.add_child_record_photo(gen_random_uuid(),'30000000-0000-4000-8000-000000000005','image/png',100)$$,'23514','photo limit','tenth photo rejected');
select lives_ok($$select public.reorder_diary_photos('30000000-0000-4000-8000-000000000005',array(select id from public.child_record_photos order by sort_order desc))$$,'owner can reverse attachment order');
select is((select sort_order from public.child_record_photos where id='40000000-0000-4000-8000-000000000001'),8,'reversed first photo becomes last');
select throws_ok($$select public.reorder_diary_photos('30000000-0000-4000-8000-000000000005',array(select case when sort_order=0 then gen_random_uuid() else id end from public.child_record_photos))$$,'22023','invalid photo order','foreign photo rejected even with matching count');
select throws_ok($$select public.reorder_diary_photos('30000000-0000-4000-8000-000000000005',array(select '40000000-0000-4000-8000-000000000001'::uuid from generate_series(1,9)))$$,'22023','invalid photo order','duplicate photos rejected');
select throws_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC","removed_photo_ids":["40000000-0000-4000-8000-000000000001"]}',true,1)$$,'22023','invalid photo removal','cannot remove a photo from another diary');
select is((select version from public.child_records where id='30000000-0000-4000-8000-000000000004'),1,'invalid removal rolls back diary edits');
select throws_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC","removed_photo_ids":["40000000-0000-4000-8000-000000000004"]}',true,999)$$,'P0001','conflict','stale edit cannot delete photos');
select lives_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC","note":"Keep the diary","removed_photo_ids":["40000000-0000-4000-8000-000000000004"]}',true,2)$$,'owner saves diary and removes selected photo atomically');
select is((select count(*)::int from public.child_record_photos where id='40000000-0000-4000-8000-000000000004'),0,'selected photo removed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.child_records),5,'viewer reads invited child');
select is((select count(*)::int from public.child_record_photos),8,'viewer reads family photos');
select ok(public.child_photo_access((select path from public.child_record_photos limit 1),false),'viewer can download');
select throws_ok($$select public.reorder_diary_photos('30000000-0000-4000-8000-000000000005',array(select id from public.child_record_photos))$$,'42501','forbidden','viewer cannot reorder photos');
select ok(not public.child_photo_access((select path from public.child_record_photos limit 1),true),'viewer cannot upload');
select throws_ok($$select public.delete_child_record('30000000-0000-4000-8000-000000000005')$$,'42501','forbidden','viewer cannot delete');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','diaper','{"kind":"wet","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC"}',null)$$,'42501','forbidden','viewer cannot save');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.child_record_day_count('20000000-0000-4000-8000-000000000001','sleep','2026-10-14','UTC')$$,'42501','forbidden','day counts cannot leak across families');
select is((select count(*)::int from public.child_records),0,'stranger sees no records');
select is((select count(*)::int from public.child_record_photos),0,'stranger sees no photos');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.save_child_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','diaper','{"kind":"dirty","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC"}',1)$$,'assigned editor can update');
select throws_ok($$select public.save_child_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000002','diaper','{"kind":"wet","occurred_at":"2026-10-14T01:00:00Z","timezone":"UTC"}',null)$$,'42501','forbidden','editor cannot write unassigned sibling');
select lives_ok($$select public.remove_child_record_photo('40000000-0000-4000-8000-000000000001')$$,'editor can remove shared photo');
reset role;
select is((select count(*)::int from public.child_photo_cleanup where path like '%/40000000-0000-4000-8000-000000000001.png'),1,'photo removal queues Storage cleanup');
create temporary table pending_child_photo as select path from public.child_record_photos where id='40000000-0000-4000-8000-000000000002';
insert into storage.objects(bucket_id,name) select 'child-care-photos',path from pending_child_photo;
select ok(public.account_has_storage('00000000-0000-4000-8000-000000000001'),'account deletion sees child-photo Storage ownership');
delete from public.profiles where id='00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.child_record_photos where record_id='30000000-0000-4000-8000-000000000005'),0,'profile deletion removes owned photo metadata');
select is((select count(*)::int from public.child_records where child_id='20000000-0000-4000-8000-000000000001' and created_by is null),5,'shared records survive author deletion anonymously');
select ok(exists(select 1 from public.child_photo_cleanup where path=(select path from pending_child_photo)),'profile deletion queues Storage paths');
select ok(public.account_has_storage('00000000-0000-4000-8000-000000000001'),'queueing alone does not imply physical file deletion');
delete from public.children where id='20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.child_records where child_id='20000000-0000-4000-8000-000000000001'),0,'child deletion cascades service records');
set local role anon;
select throws_ok($$select * from public.child_records$$,'42501',null,'anonymous reads denied');
reset role;
select * from finish();
rollback;
