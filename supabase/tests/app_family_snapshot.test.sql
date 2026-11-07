begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,email) values
('a1030000-0000-4000-8000-000000000001','snapshot-owner@example.test'),
('a1030000-0000-4000-8000-000000000002','snapshot-viewer@example.test'),
('a1030000-0000-4000-8000-000000000003','snapshot-new@example.test'),
('a1030000-0000-4000-8000-000000000004','snapshot-no-profile@example.test');
insert into profiles(id,display_name,consented_at)
select id,'Snapshot fixture',now() from auth.users where id in
('a1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000002','a1030000-0000-4000-8000-000000000003');
insert into families(id,name) values ('b1030000-0000-4000-8000-000000000001','Snapshot family');
insert into family_members(family_id,user_id,role) values
('b1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000001','owner'),
('b1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000002','viewer');
insert into children(id,family_id,name,sex,birth_date,created_at) values
('c1030000-0000-4000-8000-000000000001','b1030000-0000-4000-8000-000000000001','First child','female',current_date-180,now()-interval '2 days'),
('c1030000-0000-4000-8000-000000000002','b1030000-0000-4000-8000-000000000001','Private sibling','male',current_date-90,now()-interval '1 day');
insert into child_access(child_id,family_id,user_id,role) values
('c1030000-0000-4000-8000-000000000001','b1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000002','viewer');

-- Explicit consent is fixture setup; this RPC never creates or caches consent.
insert into signup_agreements(user_id,kind,version,interface_locale)
select p.id,d.kind,d.version,'ko' from profiles p cross join signup_document_versions d
where p.id in ('a1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000002','a1030000-0000-4000-8000-000000000003')
and d.is_current on conflict do nothing;
insert into signup_privacy_choices(user_id,version,locale,child_information,authority,health,public_sharing,neighborhood)
select id,current_signup_privacy_version(),'ko',true,true,true,false,false from profiles
where id in ('a1030000-0000-4000-8000-000000000001','a1030000-0000-4000-8000-000000000002','a1030000-0000-4000-8000-000000000003');
insert into child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
select id,'a1030000-0000-4000-8000-000000000001',current_signup_privacy_version(),true,true,true,false,false from children
where family_id='b1030000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1030000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select profile->>'id' from app_family_snapshot()),'a1030000-0000-4000-8000-000000000001','snapshot contains only the caller profile');
select is((select jsonb_array_length(children) from app_family_snapshot()),2,'owner sees both accessible children');
select is((select child->>'id' from app_family_snapshot()),'c1030000-0000-4000-8000-000000000001','default child remains the oldest created child');
select is((select child->>'id' from app_family_snapshot('c1030000-0000-4000-8000-000000000002')),'c1030000-0000-4000-8000-000000000002','explicit accessible child is selected');
select is((select child->>'id' from app_family_snapshot('c1030000-0000-4000-8000-000000000099')),'c1030000-0000-4000-8000-000000000001','unknown child keeps the existing default-child behavior');
select ok((select owner and writable from app_family_snapshot()),'owner retains write access');
select is((select family from app_family_snapshot()),(select family from family_access_context('c1030000-0000-4000-8000-000000000001')),'family context is unchanged');
select is((select members from app_family_snapshot()),(select members from family_access_context('c1030000-0000-4000-8000-000000000001')),'membership context is unchanged');
select is((select caregivers from app_family_snapshot()),(select caregivers from family_access_context('c1030000-0000-4000-8000-000000000001')),'caregivers remain scoped to the selected child');
select is((select privacy from app_family_snapshot()),privacy_state('c1030000-0000-4000-8000-000000000001'),'privacy choices match the existing fresh authorization function');

select set_config('request.jwt.claims','{"sub":"a1030000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select profile->>'id' from app_family_snapshot()),'a1030000-0000-4000-8000-000000000002','viewer receives their own profile');
select is((select jsonb_array_length(children) from app_family_snapshot()),1,'viewer cannot enumerate the private sibling');
select is((select child->>'id' from app_family_snapshot('c1030000-0000-4000-8000-000000000002')),'c1030000-0000-4000-8000-000000000001','inaccessible child falls back without revealing sibling data');
select ok((select not owner and not writable from app_family_snapshot()),'viewer remains read-only');
select is((select privacy from app_family_snapshot()),privacy_state('c1030000-0000-4000-8000-000000000001'),'viewer privacy remains delegated through the family guardian');
reset role;
delete from child_access where user_id='a1030000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select jsonb_array_length(children) from app_family_snapshot()),0,'revoked access is reflected on the next snapshot');
select ok((select child is null and family is null from app_family_snapshot()),'revoked child and family data are no longer returned');

select set_config('request.jwt.claims','{"sub":"a1030000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select jsonb_array_length(children) from app_family_snapshot()),0,'new account keeps the onboarding state');
select ok((select profile is not null and child is null from app_family_snapshot()),'new account gets a profile without a fabricated child');
select set_config('request.jwt.claims','{"sub":"a1030000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select ok((select profile is null and child is null from app_family_snapshot()),'missing profile remains an onboarding state');
reset role;

insert into data_operation_jobs(user_id) values ('a1030000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1030000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select app_family_snapshot()$$,'42501','forbidden','pending account deletion cannot read a snapshot');
reset role;
set local role anon;
select throws_ok($$select app_family_snapshot()$$,'42501',null,'anonymous callers cannot execute the snapshot RPC');
reset role;
select ok((select not prosecdef from pg_proc where oid='public.app_family_snapshot(uuid)'::regprocedure),'snapshot retains invoker privileges and table RLS');
select * from finish();
rollback;
