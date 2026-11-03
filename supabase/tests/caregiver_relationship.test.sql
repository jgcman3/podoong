begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('e1000000-0000-4000-8000-000000000001'),('e1000000-0000-4000-8000-000000000002'),('e1000000-0000-4000-8000-000000000003');
insert into profiles(id,display_name,consented_at) select id,'Relationship fixture',now() from auth.users where id::text like 'e1000000-%';
create temp table fixture(child uuid,token text);
grant all on fixture to authenticated;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
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
select throws_ok($$select create_family_with_child('Family','Baby',current_date,'female',null)$$,'22023','relationship_required','registration requires relationship');
select throws_ok($$select create_family_with_child_before_relationship('Family','Baby',current_date,'female')$$,'42501',null,'legacy registration cannot bypass required relationship');
insert into fixture(child) select create_family_with_child('Family','Baby',current_date,'female','father');
select is((select relationship::text from family_members where user_id=auth.uid()),'father','owner relation saved');
update fixture set token=create_invitation(child,'editor');
reset role;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select accept_invitation((select token from fixture),null)$$,'22023','relationship_required','invitation acceptance requires relationship');
select lives_ok($$select accept_invitation((select token from fixture),'maternal_aunt')$$,'aunt accepts invitation');
select is((select relationship::text from family_members where user_id=auth.uid()),'maternal_aunt','aunt relation persisted');
select lives_ok($$select save_growth_diary('e4000000-0000-4000-8000-000000000001',(select child from fixture),jsonb_build_object('kind','observation','occurred_at',now(),'timezone','Asia/Seoul','note','Aunt diary'),false,null)$$,'aunt writes diary');
select is((select author_relationship::text from child_records where id='e4000000-0000-4000-8000-000000000001'),'maternal_aunt','diary stores original writer relationship');
select lives_ok($$select set_caregiver_relationship((select family_id from children where id=(select child from fixture)),'mother')$$,'caregiver can update own relationship');
select is((select author_relationship::text from child_records where id='e4000000-0000-4000-8000-000000000001'),'maternal_aunt','past diary keeps relationship when written');
reset role;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select save_growth_diary('e4000000-0000-4000-8000-000000000001',(select child from fixture),jsonb_build_object('kind','observation','occurred_at',now(),'timezone','Asia/Seoul','note','Edited by dad'),false,1)$$,'another caregiver edits diary');
select is((select author_relationship from growth_diary_feed((select child from fixture),'all',0,null) where id='e4000000-0000-4000-8000-000000000001'),'maternal_aunt','public feed identifies writer not editor');
update fixture set token=manage_child_diary_link(child,'create');
select is((select author_relationship from read_child_diary_link((select token from fixture),0) where id='e4000000-0000-4000-8000-000000000001'),'maternal_aunt','shared link shows original relationship');
reset role;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select set_caregiver_relationship('e2000000-0000-4000-8000-000000000001','father')$$,'42501','forbidden','outsider cannot claim relationship');
reset role;
select * from finish();
rollback;
