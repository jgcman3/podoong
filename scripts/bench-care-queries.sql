\set ON_ERROR_STOP on
begin;
-- Local rollback-only baseline: restore the deployed index when the transaction ends.
drop index if exists public.care_latest_amount;
set local statement_timeout='90s';
insert into auth.users(id,email) values('a5900000-0000-4000-8000-000000000001','synthetic-efficiency@example.test');
insert into public.profiles(id,display_name,consented_at) values('a5900000-0000-4000-8000-000000000001','Synthetic',now());
insert into public.families(id,name) values('a5900000-0000-4000-8000-000000000002','Synthetic');
insert into public.family_members(family_id,user_id,role,relationship) values('a5900000-0000-4000-8000-000000000002','a5900000-0000-4000-8000-000000000001','owner','guardian');
insert into public.children(id,family_id,name,birth_date,sex) values('a5900000-0000-4000-8000-000000000003','a5900000-0000-4000-8000-000000000002','Synthetic','2022-01-01','female');
insert into public.child_records(id,child_id,service,kind,occurred_at,ended_at,record_timezone,created_by,updated_by)
select gen_random_uuid(),'a5900000-0000-4000-8000-000000000003',case g%4 when 0 then 'sleep' when 1 then 'diaper' when 2 then 'growth' else 'activity' end,case g%4 when 0 then 'nap' when 1 then 'wet' when 2 then 'observation' else 'bath' end,'2026-10-29T00:00:00Z'::timestamptz-g*interval '36 minutes',case when g%4=0 then '2026-10-29T00:00:00Z'::timestamptz-g*interval '36 minutes'+interval '30 minutes' end,'Asia/Seoul','a5900000-0000-4000-8000-000000000001','a5900000-0000-4000-8000-000000000001' from generate_series(1,60000) g;
insert into public.care_records(id,child_id,kind,started_at,ended_at,amount_ml,record_timezone,created_by,updated_by)
select gen_random_uuid(),'a5900000-0000-4000-8000-000000000003','formula','2026-10-29T00:00:00Z'::timestamptz-g*interval '36 minutes','2026-10-29T00:00:00Z'::timestamptz-g*interval '36 minutes'+interval '10 minutes',120,'Asia/Seoul','a5900000-0000-4000-8000-000000000001','a5900000-0000-4000-8000-000000000001' from generate_series(1,60000) g;
analyze public.child_records;
analyze public.care_records;
set local role authenticated;
set local request.jwt.claims='{"sub":"a5900000-0000-4000-8000-000000000001","role":"authenticated"}';
\echo PROFILE:before:today:0
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:before:insights:0
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:before:absent_solids:0
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
\echo PROFILE:before:today:1
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:before:insights:1
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:before:absent_solids:1
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
\echo PROFILE:before:today:2
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:before:insights:2
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:before:absent_solids:2
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
reset role;
create index efficiency_test_child_chronology on public.child_records(child_id,occurred_at desc,id);
create index efficiency_test_care_kind_amount on public.care_records(child_id,kind,started_at desc,id desc) where amount_ml is not null;
analyze public.child_records;
analyze public.care_records;
set local role authenticated;
set local request.jwt.claims='{"sub":"a5900000-0000-4000-8000-000000000001","role":"authenticated"}';
\echo PROFILE:after:today:0
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:after:insights:0
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:after:absent_solids:0
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
\echo PROFILE:after:today:1
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:after:insights:1
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:after:absent_solids:1
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
\echo PROFILE:after:today:2
explain (analyze,buffers,format json) select * from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-10-27T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z') or (service='sleep' and ended_at is null) or (timer_started=true and ended_at is null) or (kind in ('daycare','kindergarten') and attendance_status is null and ended_at is null) or (service='activity' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-10-27T00:00:00Z')) order by occurred_at desc,id limit 500 offset 0;
\echo PROFILE:after:insights:2
explain (analyze,buffers,format json) select id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm from public.child_records where child_id='a5900000-0000-4000-8000-000000000003' and ((occurred_at>='2026-09-15T00:00:00Z' and occurred_at<'2026-10-30T00:00:00Z') or (service='sleep' and occurred_at<'2026-10-30T00:00:00Z' and ended_at>='2026-09-15T00:00:00Z')) order by occurred_at,id limit 500 offset 0;
\echo PROFILE:after:absent_solids:2
explain (analyze,buffers,format json) select amount_ml from public.care_records where child_id='a5900000-0000-4000-8000-000000000003' and kind='solids' and amount_ml is not null and started_at<='2026-10-29T00:00:00Z' order by started_at desc,id desc limit 1;
reset role;
rollback;
