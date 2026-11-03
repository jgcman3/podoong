begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','sex-test@example.test');
insert into profiles(id,display_name,consented_at) values('00000000-0000-4000-8000-000000000001','Test',now());
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
select throws_ok($$select create_family_with_child('Test','Child',current_date,null,'father')$$,'22023','sex_required','onboarding rejects missing sex');
select throws_ok($$select create_family_with_child('Test','Child',current_date,'','father')$$,'22023','sex_required','onboarding rejects empty sex');
select lives_ok($$select create_family_with_child('Test','Child',current_date,'male','father')$$,'onboarding accepts selected sex');
select is((select sex from children limit 1),'male','selected sex persisted');
reset role;
select throws_ok($$update children set sex=null$$,'23502',null,'sex cannot be cleared');
set local role authenticated;
select throws_ok($$insert into children(family_id,name,birth_date) select family_id,'Sibling',current_date from children limit 1$$,'23502',null,'additional child needs sex');
select lives_ok($$insert into children(family_id,name,birth_date,sex) select family_id,'Sibling',current_date,'female' from children limit 1$$,'additional child accepts sex');
select * from finish();
rollback;
