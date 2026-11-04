begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('a9960000-0000-4000-8000-000000000001'),('a9960000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at,timezone) select id,'Push fixture',now(),'UTC' from auth.users where id::text like 'a9960000-%';
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9960000-0000-4000-8000-000000000001','Sender','KR','서울특별시 강남구','역삼동'),
('b9960000-0000-4000-8000-000000000002','Receiver','KR','서울특별시 강남구','역삼동');
insert into family_members(family_id,user_id,role,relationship) values
('b9960000-0000-4000-8000-000000000001','a9960000-0000-4000-8000-000000000001','owner','father'),
('b9960000-0000-4000-8000-000000000002','a9960000-0000-4000-8000-000000000002','owner','mother');
insert into children(id,family_id,name,sex,birth_date) values
('c9960000-0000-4000-8000-000000000001','b9960000-0000-4000-8000-000000000001','Sender','female',current_date-100),
('c9960000-0000-4000-8000-000000000002','b9960000-0000-4000-8000-000000000002','Receiver','male',current_date-100),
('c9960000-0000-4000-8000-000000000003','b9960000-0000-4000-8000-000000000001','Sibling','male',current_date-90);
insert into public.signup_agreements(user_id,kind,version,interface_locale)
select p.id,d.kind,d.version,'ko' from public.profiles p cross join public.signup_document_versions d where p.id::text like 'a9960000-%' and d.is_current on conflict do nothing;
insert into public.signup_privacy_choices(user_id,version,locale,child_information,authority,health,public_sharing,neighborhood)
select id,public.current_signup_privacy_version(),'ko',true,true,true,false,false from public.profiles where id::text like 'a9960000-%' on conflict do nothing;
insert into public.child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
select k.id,m.user_id,public.current_signup_privacy_version(),true,true,true,true,true from public.children k join public.family_members m on m.family_id=k.family_id where k.id::text like 'c9960000-%';
insert into parenting_friend_profiles(id,child_id,status) values('d9960000-0000-4000-8000-000000000002','c9960000-0000-4000-8000-000000000002','Hi');
delete from feeding_push_config;
insert into feeding_push_config(public_key,worker_url,token_secret_id) values(repeat('B',87),'https://example.invalid',(select vault.create_secret(repeat('a',64),'playground-test-'||gen_random_uuid())));
select set_config('request.jwt.claims','{"sub":"a9960000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select parenting_playground('c9960000-0000-4000-8000-000000000002');
select save_push_settings('off',180,true,false,true,jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/playground-fixture','keys',jsonb_build_object('p256dh',repeat('B',87),'auth',repeat('A',22))),'ko') where false;
select is((select playground_enabled from notification_preferences where user_id=auth.uid()),null,'no playground opt-in is assumed');
select throws_ok($$select save_push_settings('off',180,true,false,true,jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/playground-fixture','keys',jsonb_build_object('p256dh',repeat('B',87),'auth',repeat('A',22))),'ko')$$,'22023','disabled mode','both-off preferences cannot register a device');
select save_push_settings('off',180,true,true,false,jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/playground-fixture','keys',jsonb_build_object('p256dh',repeat('B',87),'auth',repeat('A',22))),'ko') as device \gset
select is((select feeding_enabled from notification_preferences where user_id=auth.uid()),false,'playground can be enabled with feeding off');
select is((select playground_enabled from notification_preferences where user_id=auth.uid()),true,'playground opt-in persists');
select throws_ok($$select * from playground_push_deliveries$$,'42501',null,'browser cannot read delivery records or endpoints');
select throws_ok($$select claim_playground_push(repeat('a',64))$$,'42501',null,'browser cannot claim jobs');
reset role;
update notification_preferences set playground_enabled=false,playground_enabled_at=now()-interval '1 hour' where user_id='a9960000-0000-4000-8000-000000000002';
update web_push_subscriptions set created_at=now()-interval '1 hour' where id=:'device';
select set_config('request.jwt.claims','{"sub":"a9960000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select parenting_playground('c9960000-0000-4000-8000-000000000001');
select parenting_playground('c9960000-0000-4000-8000-000000000003');
select send_playground_reaction('c9960000-0000-4000-8000-000000000001','d9960000-0000-4000-8000-000000000002','wave');
reset role;
select is((select count(*) from playground_push_deliveries),0::bigint,'opted-out recipient gets no queued push');
delete from parenting_playground_reactions where sender_child='c9960000-0000-4000-8000-000000000001';
update notification_preferences set playground_enabled=true where user_id='a9960000-0000-4000-8000-000000000002';
set local role authenticated;
select send_playground_reaction('c9960000-0000-4000-8000-000000000001','d9960000-0000-4000-8000-000000000002','heart');
select send_playground_reaction('c9960000-0000-4000-8000-000000000003','d9960000-0000-4000-8000-000000000002','wave');
select send_playground_reaction('c9960000-0000-4000-8000-000000000001','d9960000-0000-4000-8000-000000000002','heart');
reset role;
select is((select count(*) from playground_push_deliveries),1::bigint,'two reactions and a duplicate share one delivery');
select is((select count(*) from playground_push_deliveries where scheduled_at>now()),1::bigint,'batch waits for the two-minute window');
select is((select count(*) from claim_playground_push(repeat('a',64))),0::bigint,'a batch never sends early');
update parenting_playground_reactions set created_at=created_at-interval '3 minutes' where receiver_child='c9960000-0000-4000-8000-000000000002';
update playground_push_deliveries set batch_start=batch_start-interval '3 minutes',scheduled_at=scheduled_at-interval '3 minutes';
select throws_ok($$select claim_playground_push('wrong')$$,'42501','forbidden','worker token is verified');
create temporary table leased as select * from claim_playground_push(repeat('a',64));
select is((select count(*) from leased),1::bigint,'one due batch is claimed');
select is((select wave_count from leased),1::bigint,'batch counts waves');
select is((select heart_count from leased),1::bigint,'batch counts hearts once');
select ok((select validate_playground_push(id,lease_token) from leased),'leased batch is valid');
select is((select count(*) from claim_playground_push(repeat('a',64))),0::bigint,'another worker cannot claim a live lease');
select finish_playground_push(id,gen_random_uuid(),'sent') from leased;
select is((select status from playground_push_deliveries),'sending','stale lease cannot finish the batch');
update notification_preferences set playground_enabled=false where user_id='a9960000-0000-4000-8000-000000000002';
select ok(not (select validate_playground_push(id,lease_token) from leased),'turning off cancels eligibility before sending');
update notification_preferences set playground_enabled=true,playground_enabled_at=now()+interval '1 second' where user_id='a9960000-0000-4000-8000-000000000002';
select ok(not (select validate_playground_push(id,lease_token) from leased),'re-enabling does not backfill older reactions');
update notification_preferences set playground_enabled_at=now()-interval '1 hour',playground_quiet=true where user_id='a9960000-0000-4000-8000-000000000002';
update profiles set timezone=(select name from pg_timezone_names where extract(hour from now() at time zone name)=2 limit 1) where id='a9960000-0000-4000-8000-000000000002';
select ok(not (select validate_playground_push(id,lease_token) from leased),'night quiet hours suppress playground delivery');
update notification_preferences set playground_quiet=false where user_id='a9960000-0000-4000-8000-000000000002';
select ok((select validate_playground_push(id,lease_token) from leased),'playground quiet setting is independent of feeding');
update families set residence_locality='논현동' where id='b9960000-0000-4000-8000-000000000002';
select ok(not (select validate_playground_push(id,lease_token) from leased),'moving out of the neighborhood invalidates the batch');
update families set residence_locality='역삼동' where id='b9960000-0000-4000-8000-000000000002';
insert into data_operation_jobs(user_id) values('a9960000-0000-4000-8000-000000000002');
select ok(not (select validate_playground_push(id,lease_token) from leased),'accounts pending deletion receive no reactions');
delete from data_operation_jobs where user_id='a9960000-0000-4000-8000-000000000002';
update child_privacy_consents set neighborhood=false where child_id='c9960000-0000-4000-8000-000000000002';
select ok(not (select validate_playground_push(id,lease_token) from leased),'leaving the playground invalidates queued notifications');
select finish_playground_push(id,lease_token,'cancelled') from leased;
select is((select status from playground_push_deliveries),'cancelled','invalidated batch is cancelled');
select * from finish();
rollback;
