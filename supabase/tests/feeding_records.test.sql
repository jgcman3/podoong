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
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),null,80,'쌀죽','Asia/Seoul','',null)$$,'owner saves solids with grams and food name');
select is((select amount_g::int from public.care_records),80,'grams persisted');
select is((select food_name from public.care_records),'쌀죽','food name persisted');
select is((select record_timezone from public.care_records),'Asia/Seoul','entry timezone persisted');
select ok((select amount_ml is null from public.care_records),'food amount does not become milk volume');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),null,80,'쌀죽','Asia/Seoul','',null)$$,'retry does not duplicate');
select is((select count(*)::int from public.care_records),1,'one record after retry');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),null,90,'밥','Asia/Seoul','',1)$$,'editing kind and grams succeeds');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','solids',now(),now(),null,100,'밥','Asia/Seoul','',1)$$,'P0001','conflict','stale update blocked');
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','formula',now(),now(),100,50,'','Asia/Seoul','',null)$$,'23514',null,'milk cannot have grams');
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),100,50,'','Asia/Seoul','',null)$$,'23514',null,'solids cannot mix grams and ml');
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),null,50,'','invalid/zone','',null)$$,'P0001','invalid_timezone','invalid timezone blocked');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','formula',now()-interval '70 minutes',now()-interval '60 minutes',100,null,'','Asia/Seoul','',null)$$,'formula intake is saved');
select lives_ok($$select public.save_care_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','breast',now()-interval '130 minutes',now()-interval '120 minutes',150,'',null)$$,'original recording API remains compatible');
select ok((select record_timezone is null from public.care_records where kind='breast'),'unknown historical timezone is not fabricated');
select is((select count(*)::int from public.care_records where kind='formula'),1,'formula intake is a distinct record');
select public.save_notification_preferences(false,false,true,'00:00','00:00',9,1,30,0);
select public.sync_notifications();
select is((select count(*)::int from public.notifications where kind='feeding' and reference_id='30000000-0000-4000-8000-000000000002'),1,'formula participates in feeding reminder scheduling');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),null,50,'','Asia/Seoul','',null)$$,'42501','forbidden','viewer cannot save feeding records');
select is((select count(*)::int from public.care_records),3,'viewer sees authorized child records');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.care_records),0,'stranger cannot read feeding records');
reset role;
set local role anon;
select throws_ok($$select public.save_feeding_record(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','solids',now(),now(),null,50,'','Asia/Seoul','',null)$$,'42501',null,'anonymous mutation denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','solids',now(),now(),80,null,'','Asia/Seoul','',null)$$,'new solids volume saves in ml');
select is((select amount_ml::int from public.care_records where id='30000000-0000-4000-8000-000000000004'),80,'solids ml retained');
select ok((select amount_g is null from public.care_records where id='30000000-0000-4000-8000-000000000004'),'new volume does not fabricate grams');
select is((select amount_g::int from public.care_records where id='30000000-0000-4000-8000-000000000001'),90,'historical grams remain unchanged');
select * from finish();
rollback;
