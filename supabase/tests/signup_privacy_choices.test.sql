begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- These are test snapshots, not production consent backfills.
update signup_document_versions set is_current=false where is_current;
insert into signup_document_versions(kind,version,document_locale,snapshot,status,is_current)
values('terms','signup-2026-11-03-v1','ko','Test terms including scope notices','published',true),
('account_collection','signup-2026-11-03-v1','ko','Test collection including scope notices','published',true)
on conflict(kind,version) do update set is_current=true,status='published';
insert into auth.users(id) values('a0870000-0000-4000-8000-000000000001'),('a0870000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) values('a0870000-0000-4000-8000-000000000001','Guardian',now()),('a0870000-0000-4000-8000-000000000002','Caregiver',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values('b0870000-0000-4000-8000-000000000001','Test family','KR','서울특별시 용산구','후암동');
insert into family_members(family_id,user_id,role,relationship) values
('b0870000-0000-4000-8000-000000000001','a0870000-0000-4000-8000-000000000001','owner','father'),
('b0870000-0000-4000-8000-000000000001','a0870000-0000-4000-8000-000000000002','editor','maternal_aunt');
insert into children(id,family_id,name,sex,birth_date) values('c0870000-0000-4000-8000-000000000001','b0870000-0000-4000-8000-000000000001','Child','female',current_date-180);
insert into child_access(family_id,child_id,user_id,role) values('b0870000-0000-4000-8000-000000000001','c0870000-0000-4000-8000-000000000001','a0870000-0000-4000-8000-000000000002','editor');
select is((select count(*) from child_privacy_consents where child_id='c0870000-0000-4000-8000-000000000001'),0::bigint,'administrative imports do not fabricate consent');
select set_config('request.jwt.claims','{"sub":"a0870000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(has_signup_agreement(),false,'a historic profile timestamp is not current consent');
select throws_ok($$select accept_signup_agreements('ko','stale','stale',true,true,true,true,false,false,false)$$,'22023','agreement_required','stale snapshots rejected');
select throws_ok($$select accept_signup_agreements('ko','signup-2026-11-03-v1','signup-2026-11-03-v1',true,true,false,true,false,false,false)$$,'22023','agreement_required','child processing is required');
select lives_ok($$select accept_signup_agreements('ko','signup-2026-11-03-v1','signup-2026-11-03-v1',true,true,true,true,true,false,false)$$,'separate choices submitted in one signup action');
select is(has_signup_agreement(),true,'required signup choices recognized');
select is(privacy_state()->>'childGranted','true','signup checkboxes complete the child consent flow without email');
select is((select count(*) from information_schema.tables where table_schema='public' and table_name in ('guardian_confirmations','guardian_confirmation_requests')),0::bigint,'no email challenge tables remain');
reset role;
select set_config('request.jwt.claims','{"sub":"a0870000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(privacy_state('c0870000-0000-4000-8000-000000000001')->>'childGranted','true','delegated caregiver uses declared family guardian consent');
select lives_ok($$select save_child_record('d0870000-0000-4000-8000-000000000001','c0870000-0000-4000-8000-000000000001','growth','{"kind":"observation","occurred_at":"2026-11-01T12:00:00Z","timezone":"Asia/Seoul","note":"Hello"}')$$,'caregiver may write without claiming to be the guardian');
reset role;
select set_config('request.jwt.claims','{"sub":"a0870000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(privacy_state('c0870000-0000-4000-8000-000000000001')->>'publicSharing','false','signup never grants blanket diary publishing permission');
select lives_ok($$select save_growth_diary('d0870000-0000-4000-8000-000000000005','c0870000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-11-01T12:00:00Z","timezone":"Asia/Seoul","note":"Private by default"}')$$,'omitting publication choice saves a private diary');
select is((select everyone from growth_diary_shares where record_id='d0870000-0000-4000-8000-000000000005'),false,'new diary never auto-publishes');

select lives_ok($$select share_growth_diary('d0870000-0000-4000-8000-000000000001',true,true,'female')$$,'public sharing works with active grant');
select manage_child_diary_link('c0870000-0000-4000-8000-000000000001','create') as public_token \gset
select is(privacy_state('c0870000-0000-4000-8000-000000000001')->>'neighborhood','false','signup does not enroll a child in the playground');
select lives_ok($$select set_child_visibility('c0870000-0000-4000-8000-000000000001','neighborhood',true)$$,'first Join action enrolls this child');
select lives_ok($$select parenting_playground('c0870000-0000-4000-8000-000000000001')$$,'participation remains active on a subsequent visit');
select lives_ok($$select set_child_visibility('c0870000-0000-4000-8000-000000000001','public',false)$$,'public sharing can be withdrawn per child');
select lives_ok($$select set_child_visibility('c0870000-0000-4000-8000-000000000001','neighborhood',false)$$,'playground participation can be withdrawn per child');
select is(diary_link_child(:'public_token'),null::uuid,'withdrawal immediately revokes shared link');
select is(growth_diary_photo_allowed('d0870000-0000-4000-8000-000000000001'),false,'public photo permission revoked');
select is((select count(*) from growth_diary_feed('c0870000-0000-4000-8000-000000000001','all')),0::bigint,'withdrawn public diary absent from feed');
select is((select count(*) from child_records where id='d0870000-0000-4000-8000-000000000001'),1::bigint,'withdrawal keeps private diary');
select throws_ok($$select parenting_playground('c0870000-0000-4000-8000-000000000001')$$,'42501','neighborhood_consent_required','playground cannot bypass withdrawal');
select lives_ok($$select share_growth_diary('d0870000-0000-4000-8000-000000000001',false,false,'female')$$,'privacy-reducing operation remains allowed');
select throws_ok($$select accept_signup_agreements('ko','signup-2026-11-03-v1','signup-2026-11-03-v1',true,true,true,true,false,false,false)$$,'22023','agreement_required','signup resubmission cannot bypass required health choice');
select lives_ok($$select save_child_record('d0870000-0000-4000-8000-000000000002','c0870000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-11-01T12:00:00Z","timezone":"Asia/Seoul","weight_kg":7,"note":"Keep this memory"}')$$,'health data may be recorded with explicit health choice');
select throws_ok($$select update_health_consent(false)$$,'22023','health_records_confirmation_required','health withdrawal requires explicit deletion confirmation');
select throws_ok($$select update_health_consent(false,'DELETE HEALTH RECORDS')$$,'42501','reauthenticate','health deletion also requires recent login');
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from clock_timestamp()))))::text,true);
select lives_ok($$select update_health_consent(false,'DELETE HEALTH RECORDS')$$,'confirmed recent user may withdraw health choice');
select is((select note from child_records where id='d0870000-0000-4000-8000-000000000002'),'Keep this memory','health withdrawal preserves unrelated diary text');
select is((select weight_kg from child_records where id='d0870000-0000-4000-8000-000000000002'),null::numeric,'structured growth measurement removed');
select throws_ok($$select save_child_record('d0870000-0000-4000-8000-000000000003','c0870000-0000-4000-8000-000000000001','growth','{"kind":"measurement","occurred_at":"2026-11-01T12:00:00Z","timezone":"Asia/Seoul","weight_kg":7}')$$,'42501','health_consent_required','structured health RPC cannot bypass withdrawn choice');
select lives_ok($$insert into children(id,family_id,name,sex,birth_date) values('c0870000-0000-4000-8000-000000000002','b0870000-0000-4000-8000-000000000001','New child','male',current_date)$$,'declared guardian may register another child');
select is(privacy_state('c0870000-0000-4000-8000-000000000002')->>'childGranted','true','new child inherits explicit explicit signup choices');
select is(privacy_state('c0870000-0000-4000-8000-000000000002')->>'health','false','new child does not acquire withdrawn health scope');
select is(privacy_state('c0870000-0000-4000-8000-000000000002')->>'neighborhood','false','new sibling does not inherit participation');
select lives_ok($$select set_child_visibility('c0870000-0000-4000-8000-000000000001','public',true)$$,'guardian can explicitly enable public scope later from settings');
select share_growth_diary('d0870000-0000-4000-8000-000000000001',true,true,'female');
select manage_child_diary_link('c0870000-0000-4000-8000-000000000001','create') as second_public_token \gset
reset role;
delete from family_members where user_id='a0870000-0000-4000-8000-000000000001' and family_id='b0870000-0000-4000-8000-000000000001';
set local role anon;
select is(diary_link_child(:'second_public_token'),null::uuid,'guardian leaving family invalidates historic shared-link consent');
reset role;
select hasnt_function('public','update_privacy_choices',array['boolean','boolean','boolean','text'],'signup-wide public toggles removed');
select has_table('public','child_visibility_choices','explicit per-child choices retain evidence');
select * from finish();
rollback;
