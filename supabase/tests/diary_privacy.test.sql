begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','privacy@example.test');
insert into profiles(id,display_name,consented_at) values ('00000000-0000-4000-8000-000000000001','Owner',now());
insert into families(id,name) values ('10000000-0000-4000-8000-000000000001','Test');
insert into family_members values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner');
insert into children(id,family_id,name,birth_date,sex) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Child','2026-01-01','female');
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
select public.save_growth_diary('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-01-02T16:00:00Z","timezone":"Asia/Seoul","note":"Public"}',false);
select is((select count(*)::int from growth_diary_feed('20000000-0000-4000-8000-000000000001','all')),1,'author sees own new diary in all feed');
select ok((select same_birth_date and everyone from growth_diary_shares),'explicit public choice publishes to both audiences');
select is((select sex from children),'female','publishing preserves child sex');
select throws_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-01-02T16:00:00Z","timezone":"Asia/Seoul","note":"Stale"}',true,99)$$,'P0001','conflict','stale edit cannot change privacy');
select ok((select everyone from growth_diary_shares),'stale edit leaves publication unchanged');
select public.save_growth_diary('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2026-01-02T16:00:00Z","timezone":"Asia/Seoul","note":"Private"}',true,1);
select is((select count(*)::int from growth_diary_feed('20000000-0000-4000-8000-000000000001','all')),0,'private edit disappears from all feed');
select throws_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"kind":"observation","occurred_at":"2025-01-02T16:00:00Z","timezone":"Asia/Seoul","note":"Invalid"}',false,2)$$,'22023','birth date required','invalid publication rejected');
select is((select note from child_records),'Private','failed publication rolls back content');
select is((select version from child_records),2,'failed publication rolls back version');
select ok((select not everyone and not same_birth_date from growth_diary_shares),'failed publication preserves privacy');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.save_growth_diary('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{}',false,2)$$,'42501','forbidden','unrelated user cannot publish');
reset role;
select * from finish();
rollback;
