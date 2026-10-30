begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id) values
 ('f6200000-0000-4000-8000-000000000001'),('f6200000-0000-4000-8000-000000000002'),
 ('f6200000-0000-4000-8000-000000000003'),('f6200000-0000-4000-8000-000000000004');
insert into profiles(id,display_name,consented_at) select id,'Join fixture',now() from auth.users where id::text like 'f6200000-%';
insert into families(id,name) values
 ('a6200000-0000-4000-8000-000000000001','Destination'),('a6200000-0000-4000-8000-000000000002','Source'),('a6200000-0000-4000-8000-000000000003','Other family');
insert into family_members(family_id,user_id,role,relationship) values
 ('a6200000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','owner','father'),
 ('a6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000002','owner','mother'),
 ('a6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000003','owner','father');
insert into children(id,family_id,name,birth_date,sex) values
 ('b6200000-0000-4000-8000-000000000001','a6200000-0000-4000-8000-000000000001','Same baby',current_date,'female'),
 ('b6200000-0000-4000-8000-000000000002','a6200000-0000-4000-8000-000000000002','Same baby',current_date,'female'),
 ('b6200000-0000-4000-8000-000000000003','a6200000-0000-4000-8000-000000000002','Sibling',current_date,'male'),
 ('b6200000-0000-4000-8000-000000000004','a6200000-0000-4000-8000-000000000003','Private baby',current_date,'female');
insert into care_records(id,child_id,kind,started_at,ended_at,amount_ml,created_by,updated_by) values
 ('c6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000002','formula',now()-interval '1 hour',now()-interval '50 minutes',120,'f6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000002');
insert into child_records(id,child_id,service,kind,occurred_at,weight_kg,note,record_timezone,created_by) values
 ('d6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000002','growth','measurement',now(),8.2,'Preserved diary','Asia/Seoul','f6200000-0000-4000-8000-000000000002');
insert into child_record_photos(id,record_id,child_id,path,content_type,size_bytes,uploaded_by) values
 ('e6200000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000002/family-join-fixture/original.jpg','image/jpeg',100,'f6200000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('child-care-photos','f6200000-0000-4000-8000-000000000002/family-join-fixture/original.jpg'),('child-care-photos','f6200000-0000-4000-8000-000000000002/family-join-fixture/original.jpg.display-v1-1600.webp');
select is(account_has_storage('f6200000-0000-4000-8000-000000000002'),true,'owned files must be cleaned before owner account removal');
insert into events(child_id,title,date,created_by) values('b6200000-0000-4000-8000-000000000002','Preserved event',current_date,'f6200000-0000-4000-8000-000000000002');
insert into invitations(family_id,child_id,role,token_hash,created_by,expires_at) values
 ('a6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','editor',encode(digest('join-editor','sha256'),'hex'),'f6200000-0000-4000-8000-000000000001',now()+interval '1 day'),
 ('a6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','viewer',encode(digest('join-viewer','sha256'),'hex'),'f6200000-0000-4000-8000-000000000001',now()+interval '1 day'),
 ('a6200000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','editor',encode(digest('join-expired','sha256'),'hex'),'f6200000-0000-4000-8000-000000000001',now()-interval '1 day'),
 ('a6200000-0000-4000-8000-000000000002','b6200000-0000-4000-8000-000000000002','editor',encode(digest('old-source-invite','sha256'),'hex'),'f6200000-0000-4000-8000-000000000002',now()+interval '1 day');
create temp table review(revision text);
grant all on review to authenticated;

set local role anon;
select throws_ok($$select family_join_preview('join-editor')$$,'42501',null,'anonymous callers cannot inspect invitations');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','f6200000-0000-4000-8000-000000000002','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from now()))))::text,true);
set local role authenticated;
insert into review select family_join_preview('join-editor')->>'revision';
select is(family_join_preview('join-editor')->'target'->>'name','Destination','preview identifies destination');
select is(jsonb_array_length(family_join_preview('join-editor')->'sources'),1,'only caller families are in source scope');
select is(jsonb_array_length(family_join_preview('join-editor')->'sources'->0->'children'),2,'all source children are listed');
select throws_ok($$select accept_invitation('join-editor','mother')$$,'P0001','family_switch_confirmation_required','old RPC cannot bypass merge review');
select throws_ok($$select merge_family_from_invitation('join-editor','mother',(select revision from review),'')$$,'22023','confirmation_required','confirmation is required');
select throws_ok($$select merge_family_from_invitation('join-editor','mother','stale','MERGE FAMILY')$$,'40001','family_scope_changed','stale scope rejected');
select throws_ok($$select merge_family_from_invitation('join-expired','mother',(select revision from review),'MERGE FAMILY')$$,'P0001','invalid_invitation','expired invitation leaves old family intact');
select is((select family_id::text from children where id='b6200000-0000-4000-8000-000000000002'),'a6200000-0000-4000-8000-000000000002','failed attempts preserve child ownership');
select is((family_join_preview('join-viewer')->>'blocked')::boolean,true,'viewer invitation cannot import owned children');
select throws_ok($$select merge_family_from_invitation('join-viewer','mother',family_join_preview('join-viewer')->>'revision','MERGE FAMILY')$$,'23514','family_merge_blocked','viewer role cannot be escalated by merge');
reset role;
insert into family_members(family_id,user_id,role,relationship) values('a6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000004','viewer','grandmother');
set local role authenticated;
select is((family_join_preview('join-editor')->>'blocked')::boolean,true,'other caregivers prevent unilateral child moves');
select throws_ok($$select merge_family_from_invitation('join-editor','mother',family_join_preview('join-editor')->>'revision','MERGE FAMILY')$$,'23514','family_merge_blocked','shared family cannot be moved behind another caregiver');
reset role;
delete from family_members where family_id='a6200000-0000-4000-8000-000000000002' and user_id='f6200000-0000-4000-8000-000000000004';
insert into children(id,family_id,name,birth_date,sex) values('b6200000-0000-4000-8000-000000000005','a6200000-0000-4000-8000-000000000002','Added after review',current_date,'female');
set local role authenticated;
select throws_ok($$select merge_family_from_invitation('join-editor','mother',(select revision from review),'MERGE FAMILY')$$,'40001','family_scope_changed','new child after preview requires fresh confirmation');
reset role;
delete from children where id='b6200000-0000-4000-8000-000000000005';
select set_config('request.jwt.claims','{"sub":"f6200000-0000-4000-8000-000000000002","role":"authenticated","amr":[{"method":"oauth","timestamp":1}]}',true);
set local role authenticated;
select throws_ok($$select merge_family_from_invitation('join-editor','mother',family_join_preview('join-editor')->>'revision','MERGE FAMILY')$$,'42501','reauthenticate','child access transfer requires fresh authentication');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','f6200000-0000-4000-8000-000000000002','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from now()))))::text,true);
set local role authenticated;
select lives_ok($$select merge_family_from_invitation('join-editor','mother',family_join_preview('join-editor')->>'revision','MERGE FAMILY')$$,'merge succeeds atomically');
select is((select count(*) from children where family_id='a6200000-0000-4000-8000-000000000001'),3::bigint,'destination retains all three distinct child identities');
select is((select count(*) from children where name='Same baby'),2::bigint,'matching child names and birth dates are not deduplicated');
select is((select amount_ml from care_records where id='c6200000-0000-4000-8000-000000000001'),120::numeric,'feeding amount preserved');
select is((select note from child_records where id='d6200000-0000-4000-8000-000000000001'),'Preserved diary','diary contents preserved');
select is((select path from child_record_photos where id='e6200000-0000-4000-8000-000000000001'),'f6200000-0000-4000-8000-000000000002/family-join-fixture/original.jpg','photo identity and original path preserved');
select is((select count(*) from events where title='Preserved event'),1::bigint,'calendar preserved');
select ok(can_write_child('b6200000-0000-4000-8000-000000000002'),'joining caregiver can still edit imported child');
select is((select count(*) from family_members where user_id=auth.uid()),1::bigint,'old duplicate family membership is consolidated');
select throws_ok($$select merge_family_from_invitation('join-editor','mother',(select revision from review),'MERGE FAMILY')$$,'P0001','invalid_invitation','consumed invitation cannot be replayed');
select lives_ok($$select create_family_with_child('Duplicate','Duplicate baby',current_date,'female','mother')$$,'registration after joining returns existing child');
select throws_ok($$select delete_child_data('b6200000-0000-4000-8000-000000000002','DELETE CHILD')$$,'42501','forbidden','joining caregiver does not become family administrator');
reset role;
select is((select merged_into::text from families where id='a6200000-0000-4000-8000-000000000002'),'a6200000-0000-4000-8000-000000000001','source metadata is archived under destination instead of deleted');
select is(neighborhood_region('a6200000-0000-4000-8000-000000000002'),null::text,'archived family is not another neighborhood applicant');
select ok((select revoked_at is not null from invitations where token_hash=encode(digest('old-source-invite','sha256'),'hex')),'old source invitations cannot expose new family');
select is((select count(*) from child_photo_cleanup where path like '%/family-join-fixture/%'),0::bigint,'merge does not enqueue photo deletion');
select is(account_has_storage('f6200000-0000-4000-8000-000000000002'),false,'transferred shared files do not block former caregiver account removal');
delete from profiles where id='f6200000-0000-4000-8000-000000000002';
select is((select count(*) from child_record_photos where id='e6200000-0000-4000-8000-000000000001'),1::bigint,'former caregiver account deletion preserves transferred photos');
select is((select uploaded_by from child_record_photos where id='e6200000-0000-4000-8000-000000000001'),null::uuid,'only deleted uploader attribution is cleared');
select is((select count(*) from child_photo_cleanup where path like '%/family-join-fixture/%'),0::bigint,'surviving shared photo is not queued on uploader departure');
select set_config('request.jwt.claims',jsonb_build_object('sub','f6200000-0000-4000-8000-000000000001','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from now()))))::text,true);
set local role authenticated;
select ok(can_read_child('b6200000-0000-4000-8000-000000000002'),'destination administrator can access imported child');
select lives_ok($$select delete_child_data('b6200000-0000-4000-8000-000000000002','DELETE CHILD')$$,'administrator can explicitly delete a reviewed duplicate afterwards');
select is((select count(*) from children where family_id='a6200000-0000-4000-8000-000000000001'),2::bigint,'explicit deletion only removes the chosen child');
select * from finish();
rollback;
