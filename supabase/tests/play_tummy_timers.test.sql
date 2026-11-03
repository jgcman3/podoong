begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('e5000000-0000-4000-8000-000000000001'),('e5000000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) select id,'Timer fixture',now() from auth.users where id::text like 'e5000000-%';
insert into families(id,name) values('e6000000-0000-4000-8000-000000000001','Timer fixture');
insert into family_members(family_id,user_id,role) values('e6000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','owner');
insert into children(id,family_id,name,sex,birth_date) values('e7000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','Timer baby','female',current_date);
insert into child_records(id,child_id,service,kind,occurred_at,duration_minutes,record_timezone,created_by,updated_by) values('e8000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','activity','play',now(),10,'UTC','e5000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001');
select ok(not (select timer_started from child_records where id='e8000000-0000-4000-8000-000000000001'),'existing manual-duration records are not running timers');
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
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select save_child_record('e8000000-0000-4000-8000-000000000002','e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','play','occurred_at',now()-interval '10 minutes','timer_started',true,'timezone','UTC'))$$,'play timer can start');
select ok((select timer_started and ended_at is null from child_records where id='e8000000-0000-4000-8000-000000000002'),'running state is stored');
select throws_ok($$select save_child_record(gen_random_uuid(),'e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','play','occurred_at',now(),'timer_started',true,'timezone','UTC'))$$,'23505',null,'second active timer of same kind is rejected');
select lives_ok($$select save_child_record('e8000000-0000-4000-8000-000000000003','e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','tummy','occurred_at',now(),'timer_started',true,'timezone','UTC'))$$,'tummy timer can start independently');
select throws_ok($$select save_child_record('e8000000-0000-4000-8000-000000000002','e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','play','occurred_at',now()-interval '10 minutes','ended_at',now(),'timer_started',true,'timezone','UTC'),9)$$,'P0001','conflict','stale stop cannot overwrite a running timer');
select lives_ok($$select save_child_record('e8000000-0000-4000-8000-000000000002','e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','play','occurred_at',now()-interval '10 minutes','ended_at',now(),'timer_started',true,'timezone','UTC'),1)$$,'play timer can stop');
select is((select extract(epoch from ended_at-occurred_at)::integer from child_records where id='e8000000-0000-4000-8000-000000000002'),600,'start/end timestamps store exact elapsed time');
select throws_ok($$select save_child_record(gen_random_uuid(),'e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','bath','occurred_at',now(),'timer_started',true,'timezone','UTC'))$$,'23514',null,'timer flag is not accepted for unrelated activities');
select throws_ok($$select save_child_record(gen_random_uuid(),'e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','outing','occurred_at',now(),'timer_started',true,'timezone','UTC'))$$,'23514',null,'discontinued outing records cannot be created');
select throws_ok($$select save_child_record(gen_random_uuid(),'e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','play','occurred_at',now(),'ended_at',now()-interval '1 minute','timer_started',true,'timezone','UTC'))$$,'23514',null,'end before start is rejected');
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select save_child_record(gen_random_uuid(),'e7000000-0000-4000-8000-000000000001','activity',jsonb_build_object('kind','tummy','occurred_at',now(),'timer_started',true,'timezone','UTC'))$$,'42501','forbidden','other accounts cannot start timers');
select * from finish();
rollback;
