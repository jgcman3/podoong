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
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),80,'쌀죽','Asia/Seoul','',null)$$,'owner saves solids volume and food name');
select is((select amount_ml::int from public.care_records),80,'ml persisted');
select is((select food_name from public.care_records),'쌀죽','food name persisted');
select is((select record_timezone from public.care_records),'Asia/Seoul','entry timezone persisted');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),80,'쌀죽','Asia/Seoul','',null)$$,'retry does not duplicate');
select is((select count(*)::int from public.care_records),1,'one record after retry');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),90,'밥','Asia/Seoul','',1)$$,'editing kind and volume succeeds');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),100,'밥','Asia/Seoul','',1)$$,'P0001','conflict','stale update blocked');
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),50,'','invalid/zone','',null)$$,'P0001','invalid_timezone','invalid timezone blocked');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','formula',now()-interval '70 minutes',now()-interval '60 minutes',100,'','Asia/Seoul','',null)$$,'formula intake is saved');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','breast',now()-interval '130 minutes',now()-interval '120 minutes',150,'','UTC','',null)$$,'current feeding API saves breast volume');
select is((select record_timezone from public.care_records where kind='breast'),'UTC','current API stores the supplied timezone');
select is((select count(*)::int from public.care_records where kind='formula'),1,'formula intake is a distinct record');
select public.save_feeding_push_preferences(true,30,false);
select public.sync_notifications();
select is((select count(*)::int from public.notifications where kind='feeding' and reference_id='30000000-0000-4000-8000-000000000002'),1,'formula participates in feeding reminder scheduling');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),50,'','Asia/Seoul','',null)$$,'42501','forbidden','viewer cannot save feeding records');
select is((select count(*)::int from public.care_records),3,'viewer sees authorized child records');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.care_records),0,'stranger cannot read feeding records');
reset role;
set local role anon;
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),50,'','Asia/Seoul','',null)$$,'42501',null,'anonymous mutation denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','solids',now(),now(),80,'','Asia/Seoul','',null)$$,'new solids volume saves in ml');
select is((select amount_ml::int from public.care_records where id='30000000-0000-4000-8000-000000000004'),80,'solids ml retained');
select is((select amount_ml::int from public.care_records where id='30000000-0000-4000-8000-000000000001'),90,'edited ml amount remains unchanged');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='care_records' and column_name='amount_g'),0::bigint,'feeding storage only contains the current ml amount');
select ok(to_regprocedure('public.save_care_record(uuid,uuid,text,timestamptz,timestamptz,numeric,text,integer)') is null,'old care write API is absent');
select ok(to_regprocedure('public.save_event(uuid,uuid,text,date,text)') is null,'old event write API is absent');
select * from finish();
rollback;
