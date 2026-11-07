begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,email) values
('a1040000-0000-4000-8000-000000000001','install-guide-one@example.test'),
('a1040000-0000-4000-8000-000000000002','install-guide-two@example.test');
insert into profiles(id,display_name,consented_at) values
('a1040000-0000-4000-8000-000000000001','First caregiver',now()),
('a1040000-0000-4000-8000-000000000002','Second caregiver',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1040000-0000-4000-8000-000000000001","role":"authenticated"}',true);
with claimed as (
 update profiles set install_guide_seen_at=now()
 where id=auth.uid() and install_guide_seen_at is null returning id
) select is((select count(*) from claimed),1::bigint,'first account visit claims its guide');
select ok((select install_guide_seen_at is not null from profiles where id=auth.uid()),'seen state is persisted on the profile');
with claimed as (
 update profiles set install_guide_seen_at=now()
 where id=auth.uid() and install_guide_seen_at is null returning id
) select is((select count(*) from claimed),0::bigint,'later visits cannot claim the guide again');
with changed as (
 update profiles set install_guide_seen_at=now()
 where id='a1040000-0000-4000-8000-000000000002' returning id
) select is((select count(*) from changed),0::bigint,'one caregiver cannot consume another account guide');
reset role;
select ok((select install_guide_seen_at is null from profiles where id='a1040000-0000-4000-8000-000000000002'),'other account remains eligible');

insert into data_operation_jobs(user_id) values ('a1040000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1040000-0000-4000-8000-000000000002","role":"authenticated"}',true);
with changed as (
 update profiles set install_guide_seen_at=now()
 where id=auth.uid() returning id
) select is((select count(*) from changed),0::bigint,'inactive accounts retain the existing write restriction');
reset role;
set local role anon;
select throws_ok($$update public.profiles set install_guide_seen_at=now()$$,'42501',null,'anonymous callers cannot change guide state');
reset role;
select * from finish();
rollback;
