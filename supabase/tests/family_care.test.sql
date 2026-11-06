begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','owner@example.test'),
('00000000-0000-4000-8000-000000000002','viewer@example.test'),
('00000000-0000-4000-8000-000000000003','stranger@example.test');
insert into public.profiles(id,display_name,consented_at) select id,'Test',now() from auth.users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into public.families(id,name) values('10000000-0000-4000-8000-000000000001','Test Family');
insert into public.family_members values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');
insert into public.children(sex,id,family_id,name,birth_date) values
('female','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Shared','2026-10-20'),
('female','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Private','2026-10-20');
insert into public.child_access values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','viewer');

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
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.children),0,'another family cannot read children');
select throws_ok($$select public.update_child_details('20000000-0000-4000-8000-000000000001','No','male','2026-10-20')$$,'42501','forbidden','outsider cannot update child details');
select is((select count(*)::int from public.family_members),0,'another family cannot read membership');
select throws_ok($$select * from public.list_caregivers('20000000-0000-4000-8000-000000000001')$$,'42501','forbidden','caregiver names cannot cross family boundaries');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.children),1,'viewer sees only invited child');
select ok(public.can_read_child('20000000-0000-4000-8000-000000000001'),'viewer reads assigned child');
select throws_ok($$select public.update_child_details('20000000-0000-4000-8000-000000000001','No','male','2026-10-20')$$,'42501','forbidden','viewer cannot update child details');
select ok(not public.can_read_child('20000000-0000-4000-8000-000000000002'),'viewer cannot read sibling');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','formula',now(),now(),100,'','UTC','',null)$$,'42501','forbidden','viewer cannot save care');
select throws_ok($$select public.update_child_birth_date('20000000-0000-4000-8000-000000000001','2026-10-21')$$,'42501','forbidden','viewer cannot change dates');
select throws_ok($$insert into public.family_members values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','owner')$$,'42501',null,'direct member escalation denied');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from public.children),2,'owner sees both children');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','formula','2026-10-12T10:00Z','2026-10-12T10:10Z',100,'','UTC','first',null)$$,'owner saves record');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','formula','2026-10-12T10:00Z','2026-10-12T10:10Z',100,'','UTC','first',null)$$,'repeated save is idempotent');
select is((select count(*)::int from public.care_records),1,'retry does not duplicate record');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','formula','2026-10-12T10:00Z','2026-10-12T10:10Z',120,'','UTC','edited',1)$$,'record edit succeeds');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','formula','2026-10-12T10:00Z','2026-10-12T10:10Z',140,'','UTC','stale',1)$$,'P0001','conflict','stale edit rejected');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','formula','2026-10-12T10:00Z','2026-10-12T09:00Z',100,'','UTC','',null)$$,'23514',null,'backwards time rejected');
select lives_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','breast',now(),null,null,'','UTC','',null)$$,'timer persisted');
select throws_ok($$select public.save_feeding_record('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','breast',now(),null,null,'','UTC','',null)$$,'23505',null,'second active timer rejected');
select lives_ok($$select public.update_child_birth_date('20000000-0000-4000-8000-000000000001','2026-10-12')$$,'birth transition succeeds');
select is((select id::text from public.children where name='Shared'),'20000000-0000-4000-8000-000000000001','child identity preserved');
select throws_ok($$insert into public.care_records(id,child_id,kind,started_at,created_by,updated_by) values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','breast',now(),auth.uid(),auth.uid())$$,'42501',null,'direct unaudited insert denied');

reset role;
insert into public.invitations(id,family_id,child_id,role,token_hash,created_by,expires_at) values
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','editor',encode(extensions.digest('valid','sha256'),'hex'),'00000000-0000-4000-8000-000000000001',now()+interval '1 day'),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','editor',encode(extensions.digest('expired','sha256'),'hex'),'00000000-0000-4000-8000-000000000001',now()-interval '1 day'),
('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','editor',encode(extensions.digest('revoked','sha256'),'hex'),'00000000-0000-4000-8000-000000000001',now()+interval '1 day');
update public.invitations set revoked_at=now() where id='60000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.accept_invitation('expired','father')$$,'P0001','invalid_invitation','expired invite rejected');
select throws_ok($$select public.accept_invitation('revoked','father')$$,'P0001','invalid_invitation','revoked invite rejected');
select lives_ok($$select public.accept_invitation('valid','father')$$,'invite accepted');
select throws_ok($$select public.accept_invitation('valid','father')$$,'P0001','invalid_invitation','used invite rejected');
select is((select count(*)::int from public.children),1,'new editor sees invited child only');
select ok(public.can_write_child('20000000-0000-4000-8000-000000000001'),'new editor can write');
select lives_ok($$select public.update_child_details('20000000-0000-4000-8000-000000000001','Updated','male','2026-10-20')$$,'editor updates child details');
select is((select name from public.children where id='20000000-0000-4000-8000-000000000001'),'Updated','child name persisted');
select throws_ok($$select public.update_child_details('20000000-0000-4000-8000-000000000001','','male','2026-10-20')$$,'22023','invalid_child_details','empty name rejected');
select throws_ok($$select public.update_child_details('20000000-0000-4000-8000-000000000001','Updated',null,'2026-10-20')$$,'22023','invalid_child_details','missing sex rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.revoke_member('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003')$$,'owner revokes editor');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.children),0,'revoked editor immediately loses read access');
set local role anon;
select is((select count(*)::int from public.content_items),0,'draft content hidden from signed-out users');
select is((select count(*)::int from public.content_translations),0,'draft translations hidden');
select throws_ok($$select public.is_family_owner('10000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous cannot enumerate owners');
select * from finish();
rollback;
