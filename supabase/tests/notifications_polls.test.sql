begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select has_table('public','notifications','inbox exists');
select has_table('public','daily_polls','daily polls exist');
select ok(notification_quiet('23:00','07:00',time '00:30'),'cross-midnight quiet hours');
select ok(not notification_quiet('23:00','07:00',time '12:00'),'daytime outside quiet hours');
insert into auth.users(id) values('c1000000-0000-4000-8000-000000000001'),('c1000000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,timezone,consented_at) values('c1000000-0000-4000-8000-000000000001','Tester','UTC',now()),('c1000000-0000-4000-8000-000000000002','Moderator','UTC',now());
insert into community_moderators values('c1000000-0000-4000-8000-000000000002');
insert into families(id,name) values('c2000000-0000-4000-8000-000000000001','Fixture');
insert into family_members values('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','editor');
insert into children(sex,id,family_id,name,birth_date) values('female','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Fixture',current_date);
insert into child_access values('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','editor');
insert into notification_preferences(user_id,quiet_start,quiet_end,frequency_minutes) values('c1000000-0000-4000-8000-000000000001','00:00','00:00',1);
-- Test-only setup for fixtures whose caregivers already accepted signup notices.
-- Consent-specific tests use the public acceptance RPC and do not include this file.
insert into public.signup_agreements(user_id,kind,version,interface_locale)
select p.id,d.kind,d.version,'ko' from public.profiles p cross join public.signup_document_versions d
where d.is_current on conflict do nothing;
insert into public.signup_privacy_choices(user_id,version,locale,child_information,authority,health,public_sharing,neighborhood)
select id,public.current_signup_privacy_version(),'ko',true,true,true,false,false from public.profiles
on conflict do nothing;
-- These multi-caregiver fixtures explicitly represent consenting family guardians.
insert into public.child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
select k.id,m.user_id,public.current_signup_privacy_version(),true,true,true,true,true
from public.children k join public.family_members m on m.family_id=k.family_id
where m.role in ('owner','editor') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select run_notification_jobs()$$,'42501',null,'ordinary user cannot run all jobs');
select lives_ok($$select sync_notifications()$$,'own inbox sync allowed');
select throws_ok($$select notification_quiet('23:00','07:00','00:30')$$,'42501',null,'private helper is not executable');
reset role;
insert into care_records(id,child_id,kind,started_at,ended_at,created_by,updated_by) values('c6000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','formula',clock_timestamp()-interval '32 minutes',clock_timestamp()-interval '31 minutes','c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001');
update notification_preferences set feeding_enabled=true,feeding_interval_minutes=30,quiet_start=((clock_timestamp() at time zone 'UTC')-interval '1 hour')::time,quiet_end=((clock_timestamp() at time zone 'UTC')+interval '1 hour')::time;
set local role authenticated;
select sync_notifications();
select is((select count(*)::int from notifications),0,'quiet hours hold due feeding reminder');
reset role;
create temporary table pending_tuple as select ctid::text as tuple from notifications where kind='feeding';
select deliver_notifications_internal('c1000000-0000-4000-8000-000000000001');
select is((select ctid::text from notifications where kind='feeding'),(select tuple from pending_tuple),'repeated quiet-hour job does not rewrite unchanged pending reminder');
update notification_preferences set quiet_start='00:00',quiet_end='00:00',snooze_until=clock_timestamp()+interval '1 hour';
set local role authenticated;
select sync_notifications();
select is((select count(*)::int from notifications),0,'global snooze holds reminder');
reset role;
update notification_preferences set snooze_until=null;
set local role authenticated;
select sync_notifications();
select is((select count(*)::int from notifications where kind='feeding'),1,'user chosen feeding interval delivers');
select sync_notifications();
select is((select count(*)::int from notifications where kind='feeding'),1,'feeding reminder deduped');
reset role;
insert into care_records(id,child_id,kind,started_at,ended_at,created_by,updated_by) values('c6000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','formula',clock_timestamp()-interval '2 minutes',null,'c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::int from notifications where kind='feeding'),0,'new active feeding invalidates old reminder');
select throws_ok($$select save_daily_poll('c5000000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'Asia/Seoul')::date,'질문','Question','[{"ko":"하나","en":"One"},{"ko":"둘","en":"Two"}]')$$,'42501','forbidden','ordinary user cannot create polls');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select save_daily_poll('c5000000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'Asia/Seoul')::date,'질문','Question','[{"ko":"하나","en":"One"},{"ko":"둘","en":"Two"}]')$$,'moderator creates bilingual daily poll');
select is((select closes_at-opens_at from daily_polls where id='c5000000-0000-4000-8000-000000000001'),interval '1 day','poll closes at next Seoul midnight');
select throws_ok($$select save_daily_poll('c5000000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'Asia/Seoul')::date,'변경','Changed','[{"ko":"하나","en":"One"},{"ko":"둘","en":"Two"}]')$$,'P0001','already_open','opened question cannot change');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select poll_results('c5000000-0000-4000-8000-000000000001')$$,'nonvoter can read aggregate results');
select vote_daily_poll('c5000000-0000-4000-8000-000000000001',0);
select vote_daily_poll('c5000000-0000-4000-8000-000000000001',1);
select is((select count(*)::int from daily_poll_votes),1,'changed vote remains one vote');
select is((select option_index::int from daily_poll_votes),1,'own selection changes');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from daily_poll_votes),0,'moderator cannot read another voter identity');
select hide_daily_poll('c5000000-0000-4000-8000-000000000001',true,'Fixture moderation');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from daily_polls),0,'hidden poll disappears');
select throws_ok($$select vote_daily_poll('c5000000-0000-4000-8000-000000000001',0)$$,'P0001','poll_closed','hidden poll rejects votes');
reset role;
insert into daily_polls(id,day,question_ko,question_en,options) values('c5000000-0000-4000-8000-000000000002',(clock_timestamp() at time zone 'Asia/Seoul')::date-1,'지난 질문','Past question','[{"ko":"하나","en":"One"},{"ko":"둘","en":"Two"}]');
set local role authenticated;
select throws_ok($$select vote_daily_poll('c5000000-0000-4000-8000-000000000002',0)$$,'P0001','poll_closed','closed poll rejects late vote');
-- Induce a real write failure inside the job subtransaction; keep only SQLSTATE.
reset role;
update care_records set started_at=clock_timestamp()-interval '32 minutes',ended_at=clock_timestamp()-interval '31 minutes' where id='c6000000-0000-4000-8000-000000000002';
alter table notifications add constraint simulated_delivery_failure check(false) not valid;
set local role authenticated;
select sync_notifications();
select throws_ok($$select retry_notification_job('c7000000-0000-4000-8000-000000000009')$$,'42501','forbidden','ordinary user cannot retry jobs');
reset role;
select is((select error_code from notification_job_runs where status='failed' and recipient_id='c1000000-0000-4000-8000-000000000001' order by started_at desc limit 1),'23514','real job failure retains only SQLSTATE');
alter table notifications drop constraint simulated_delivery_failure;
select set_config('test.failed_job',(select id::text from notification_job_runs where status='failed' and recipient_id='c1000000-0000-4000-8000-000000000001' order by started_at desc limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select retry_notification_job(current_setting('test.failed_job')::uuid)$$,'moderator retries real failed job');
select is((select status from notification_job_runs where id=current_setting('test.failed_job')::uuid),'succeeded','retry succeeds after real failure removed');
select is((select attempts from notification_job_runs where id=current_setting('test.failed_job')::uuid),2,'retry increments attempt count');
select * from finish();
rollback;
