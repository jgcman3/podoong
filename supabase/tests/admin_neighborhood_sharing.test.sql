begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('a9820000-0000-4000-8000-000000000001'),('a9820000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) values('a9820000-0000-4000-8000-000000000001','Owner',now()),('a9820000-0000-4000-8000-000000000002','Other',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9820000-0000-4000-8000-000000000001','포둥네','KR','개방검증시','역삼동'),('b9820000-0000-4000-8000-000000000002','Other','KR','개방검증시','역삼동');
insert into family_members(family_id,user_id,role,relationship) values('b9820000-0000-4000-8000-000000000001','a9820000-0000-4000-8000-000000000001','owner','mother'),('b9820000-0000-4000-8000-000000000002','a9820000-0000-4000-8000-000000000002','owner','father');
insert into children(id,family_id,name,sex,birth_date) values
('c9820000-0000-4000-8000-000000000001','b9820000-0000-4000-8000-000000000001','지혜','female',current_date-180),
('c9820000-0000-4000-8000-000000000002','b9820000-0000-4000-8000-000000000001','동생','male',current_date-90),
('c9820000-0000-4000-8000-000000000003','b9820000-0000-4000-8000-000000000001','미접속','female',current_date-300),
('c9820000-0000-4000-8000-000000000004','b9820000-0000-4000-8000-000000000002','Other child','male',current_date-400);


delete from public.service_action_daily;
delete from public.invitations;
set local role anon;
select throws_ok($$select record_service_action('moment_save_attempt')$$,'42501',null,'anonymous action recording is denied');
reset role;
select set_config('request.jwt.claims','{"sub":"a9820000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select admin_sharing_usage(7)$$,'42501','forbidden','ordinary users cannot read counters');
select throws_ok($$select admin_neighborhoods()$$,'42501','forbidden','ordinary users cannot inspect local families');
select throws_ok($$select * from service_action_daily$$,'42501',null,'raw counters remain private');
select record_service_action('moment_share_attempt');
select record_service_action('moment_share_attempt');
select throws_ok($$select record_service_action('private-child-name')$$,'22023','invalid action','action text cannot contain arbitrary information');
reset role;
select columns_are('public','service_action_daily',array['day','action','attempts'],'no visitor or content columns are stored');
insert into service_admins(user_id) values('a9820000-0000-4000-8000-000000000001');
insert into invitations(family_id,child_id,role,token_hash,created_by,accepted_at) values
('b9820000-0000-4000-8000-000000000001','c9820000-0000-4000-8000-000000000001','editor','sharing-fixture-1','a9820000-0000-4000-8000-000000000001',now()),
('b9820000-0000-4000-8000-000000000001','c9820000-0000-4000-8000-000000000001','editor','sharing-fixture-2','a9820000-0000-4000-8000-000000000001',null);
insert into invitations(family_id,child_id,role,token_hash,created_by,created_at) values
('b9820000-0000-4000-8000-000000000001','c9820000-0000-4000-8000-000000000001','editor','sharing-fixture-old','a9820000-0000-4000-8000-000000000001',null);
set local role authenticated;
select is((admin_sharing_usage(7)->'invitations'->>'created')::integer,2,'only measured invitations count');
select is((admin_sharing_usage(7)->'invitations'->>'accepted')::integer,1,'acceptance uses the same creation cohort');
select is((admin_sharing_usage(7)->'invitations'->>'pending')::integer,1,'pending invitations exclude the unmeasured past');
select is((admin_sharing_usage(7)->'actions'->3->>'attempts')::integer,2,'repeated share attempts are counted without identities');
select throws_ok($$select admin_sharing_usage(365)$$,'22023','invalid period','analysis periods are bounded');
select is((select families::integer from admin_neighborhoods() where region='KR 개방검증시 역삼동'),2,'siblings do not inflate board families');
select is((select opened from admin_neighborhoods() where region='KR 개방검증시 역삼동'),false,'admin status matches a closed board');
select is((select missing from admin_neighborhoods() where region='KR 개방검증시 역삼동'),1,'shows the exact shortage');
reset role;
select set_config('request.jwt.claims','{}',true);
insert into auth.users(id) values('a9820000-0000-4000-8000-000000000003');
insert into profiles(id,display_name,consented_at) values('a9820000-0000-4000-8000-000000000003','Third',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values('b9820000-0000-4000-8000-000000000003','Third','KR','개방검증시','역삼동');
insert into family_members(family_id,user_id,role) values('b9820000-0000-4000-8000-000000000003','a9820000-0000-4000-8000-000000000003','owner');
insert into children(id,family_id,name,sex,birth_date) values('c9820000-0000-4000-8000-000000000005','b9820000-0000-4000-8000-000000000003','Third child','male',current_date-90);
select set_config('request.jwt.claims','{"sub":"a9820000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select neighborhood_board_status('b9820000-0000-4000-8000-000000000001');
select is((select opened from admin_neighborhoods() where region='KR 개방검증시 역삼동'),true,'admin status matches an open board');
select is((select jsonb_array_length(founders) from admin_neighborhoods() where region='KR 개방검증시 역삼동'),3,'the latest announcement exposes exactly three family labels to admin');
reset role;
update families set residence_locality='다른동' where id='b9820000-0000-4000-8000-000000000003';
update families set residence_locality='역삼동',name='Reopened third' where id='b9820000-0000-4000-8000-000000000003';
set local role authenticated;
select neighborhood_board_status('b9820000-0000-4000-8000-000000000001');
select is((select reopenings from admin_neighborhoods() where region='KR 개방검증시 역삼동'),1,'admin sees reopening count');
select ok((select founders ? 'Reopened third' from admin_neighborhoods() where region='KR 개방검증시 역삼동'),'admin sees refreshed family labels');
reset role;
insert into service_action_daily(day,action,attempts) values((now() at time zone 'Asia/Seoul')::date-90,'introduction_copy',1),((now() at time zone 'Asia/Seoul')::date-89,'introduction_copy',1);
select cleanup_service_usage();
select is((select count(*)::integer from service_action_daily where day<(now() at time zone 'Asia/Seoul')::date-89),0,'existing cleanup removes action counters after 90 days');
select is((select count(*)::integer from service_action_daily where day=(now() at time zone 'Asia/Seoul')::date-89),1,'90-day boundary is preserved');
select * from finish();
rollback;
