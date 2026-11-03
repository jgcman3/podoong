begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('a9710000-0000-4000-8000-000000000001'),('a9710000-0000-4000-8000-000000000002');
insert into profiles(id,display_name,consented_at) values('a9710000-0000-4000-8000-000000000001','Owner',now()),('a9710000-0000-4000-8000-000000000002','Other',now());
insert into families(id,name,residence_country_code,residence_city,residence_locality) values
('b9710000-0000-4000-8000-000000000001','포둥네','KR','서울특별시 강남구','역삼동'),('b9710000-0000-4000-8000-000000000002','Other','KR','서울특별시 강남구','논현동');
insert into family_members(family_id,user_id,role,relationship) values('b9710000-0000-4000-8000-000000000001','a9710000-0000-4000-8000-000000000001','owner','mother'),('b9710000-0000-4000-8000-000000000002','a9710000-0000-4000-8000-000000000002','owner','father');
insert into children(id,family_id,name,sex,birth_date) values
('c9710000-0000-4000-8000-000000000001','b9710000-0000-4000-8000-000000000001','지혜','female',current_date-180),
('c9710000-0000-4000-8000-000000000002','b9710000-0000-4000-8000-000000000001','동생','male',current_date-90),
('c9710000-0000-4000-8000-000000000003','b9710000-0000-4000-8000-000000000001','미접속','female',current_date-300),
('c9710000-0000-4000-8000-000000000004','b9710000-0000-4000-8000-000000000002','Other child','male',current_date-400);
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
insert into parenting_friend_profiles(child_id,nickname,status) select id,'Ignored nickname','Hello' from children where id::text like 'c9710000-%';
select id as peer from parenting_friend_profiles where child_id='c9710000-0000-4000-8000-000000000002' \gset
select id as outsider from parenting_friend_profiles where child_id='c9710000-0000-4000-8000-000000000004' \gset
select set_config('request.jwt.claims','{"sub":"a9710000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select parenting_playground('c9710000-0000-4000-8000-000000000001');
select parenting_playground('c9710000-0000-4000-8000-000000000002');
select lives_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','wave'),'can wave to a child attending the same neighborhood');
select lives_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','wave'),'repeated taps are idempotent');
select lives_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','heart'),'can send a separate heart');
select lives_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','comfort'),'can send comfort');
select is(jsonb_array_length(playground_reactions('c9710000-0000-4000-8000-000000000002')->'items'),3,'receiver sees each kind once');
select is(playground_reactions('c9710000-0000-4000-8000-000000000002')->'items'->0->>'name','포둥네 지혜','received reactions use the generated sender name');
select is(jsonb_array_length(playground_reactions('c9710000-0000-4000-8000-000000000001')->'items'),0,'outgoing reactions are not received history');
select throws_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'outsider','wave'),'22023','friend unavailable','cannot react to a different neighborhood');
select throws_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','invalid'),'22023','invalid reaction','only supported reactions are accepted');
select throws_ok($$select * from parenting_playground_reactions$$,'42501',null,'raw child identities and reactions are private');
reset role;
update parenting_playground_reactions set day=day-1 where receiver_child='c9710000-0000-4000-8000-000000000002';
set local role authenticated;
select is(jsonb_array_length(playground_reactions('c9710000-0000-4000-8000-000000000002')->'items'),0,'yesterday history resets without a batch job');
select lives_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','wave'),'can wave again on a new day');
select is(jsonb_array_length(playground_reactions('c9710000-0000-4000-8000-000000000002')->'items'),1,'new day contains only the new wave');
reset role;
select set_config('request.jwt.claims','{"sub":"a9710000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select playground_reactions('c9710000-0000-4000-8000-000000000002')$$,'42501','forbidden','other families cannot read received history');
select throws_ok(format('select send_playground_reaction(%L,%L,%L)','c9710000-0000-4000-8000-000000000001',:'peer','wave'),'42501','forbidden','cannot impersonate another family child');
reset role;
set local role anon;
select throws_ok($$select playground_reactions('c9710000-0000-4000-8000-000000000002')$$,'42501',null,'anonymous access is denied');
reset role;
select * from finish();rollback;
