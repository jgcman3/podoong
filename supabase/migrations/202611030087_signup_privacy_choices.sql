begin;
-- Every choice is anchored to the two immutable signup notice snapshots.
-- Signup records a self-declared authority checkbox; this is not identity or kinship verification.
create table public.signup_privacy_choices (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null,
 locale text not null check(locale in ('ko','en')),
 child_information boolean not null,
 authority boolean not null,
 health boolean not null,
 public_sharing boolean not null,
 neighborhood boolean not null,
 accepted_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.child_privacy_consents (
 child_id uuid not null references public.children(id) on delete cascade,
 accepted_by uuid not null references auth.users(id) on delete cascade,
 version text not null,
 child_information boolean not null,
 authority boolean not null,
 health boolean not null,
 public_sharing boolean not null,
 neighborhood boolean not null,
 accepted_at timestamptz not null default clock_timestamp(),
 withdrawn_at timestamptz,
 primary key(child_id,accepted_by,version)
);
create index child_privacy_guardian on public.child_privacy_consents(accepted_by,child_id);
alter table public.signup_privacy_choices enable row level security;
alter table public.child_privacy_consents enable row level security;
revoke all on public.signup_privacy_choices,public.child_privacy_consents from public,anon,authenticated;
grant all on public.signup_privacy_choices,public.child_privacy_consents to service_role;

create function public.current_signup_privacy_version() returns text
language sql stable security definer set search_path='' as $$
 select 'signup-2026-11-03-v1'::text where
 (select count(*) from public.signup_document_versions where is_current and status='published' and version='signup-2026-11-03-v1')=2;
$$;
create or replace function public.has_signup_agreement() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.account_active() and exists(
 select 1 from public.signup_privacy_choices c where c.user_id=auth.uid()
 and c.version=public.current_signup_privacy_version() and c.child_information and c.authority
 and not exists(select 1 from public.signup_document_versions d where d.is_current
 and not exists(select 1 from public.signup_agreements a where a.user_id=c.user_id and a.kind=d.kind and a.version=d.version)));
$$;
drop function public.accept_signup_agreements(text,text,text,boolean,boolean);
create function public.accept_signup_agreements(p_locale text,p_terms_version text,p_collection_version text,p_terms boolean,p_collection boolean,
 p_child_information boolean,p_authority boolean,p_health boolean,p_public_sharing boolean,p_neighborhood boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v text:=public.current_signup_privacy_version(); old_choice public.signup_privacy_choices;
begin
 if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
 if v is null or p_terms_version is distinct from v or p_collection_version is distinct from v
 or p_locale is null or p_locale not in ('ko','en') or p_terms is distinct from true or p_collection is distinct from true
 or p_child_information is distinct from true or p_authority is distinct from true
 or p_health is distinct from true or p_public_sharing is distinct from false or p_neighborhood is distinct from false
 then raise exception 'agreement_required' using errcode='22023'; end if;
 -- A repeat submission cannot bypass the dedicated withdrawal safeguards.
 select * into old_choice from public.signup_privacy_choices where user_id=auth.uid() for update;
 if old_choice.version=v then
  if old_choice.health is distinct from p_health
  then raise exception 'use_privacy_settings' using errcode='22023'; end if;
  perform public.bind_declared_children(auth.uid());
  return;
 end if;
 insert into public.signup_agreements(user_id,kind,version,interface_locale)
 values(auth.uid(),'terms',v,p_locale),(auth.uid(),'account_collection',v,p_locale) on conflict do nothing;
 insert into public.signup_privacy_choices(user_id,version,locale,child_information,authority,health,public_sharing,neighborhood)
 values(auth.uid(),v,p_locale,true,true,p_health,p_public_sharing,p_neighborhood)
 on conflict(user_id) do update set version=excluded.version,locale=excluded.locale,child_information=true,authority=true,
 health=excluded.health,public_sharing=excluded.public_sharing,neighborhood=excluded.neighborhood,accepted_at=clock_timestamp(),updated_at=clock_timestamp();
 perform public.bind_declared_children(auth.uid());
end $$;

create function public.guardian_declared(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.signup_privacy_choices c
 where c.user_id=p_user and c.version=public.current_signup_privacy_version() and c.child_information and c.authority
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=c.user_id)
 and not exists(select 1 from public.signup_document_versions d where d.is_current and not exists(
 select 1 from public.signup_agreements a where a.user_id=c.user_id and a.kind=d.kind and a.version=d.version)));
$$;
create function public.bind_declared_children(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not public.guardian_declared(p_user) then return; end if;
 insert into public.child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
 select k.id,c.user_id,c.version,c.child_information,c.authority,c.health,c.public_sharing,c.neighborhood
 from public.children k join public.family_members m on m.family_id=k.family_id and m.user_id=p_user and m.role='owner'
 join public.signup_privacy_choices c on c.user_id=p_user
 on conflict(child_id,accepted_by,version) do nothing;
end $$;
create function public.child_privacy_allowed(p_child uuid,p_scope text default 'child') returns boolean
language sql stable security definer set search_path='' as $$
 select p_scope in ('child','health','public','neighborhood') and exists(
 select 1 from public.child_privacy_consents g join public.children k on k.id=g.child_id
 join public.family_members m on m.family_id=k.family_id and m.user_id=g.accepted_by
 join public.signup_privacy_choices c on c.user_id=g.accepted_by and c.version=g.version
 where g.child_id=p_child and g.version=public.current_signup_privacy_version() and g.withdrawn_at is null
 and g.child_information and g.authority and public.guardian_declared(g.accepted_by)
 and case p_scope when 'health' then g.health and c.health when 'public' then g.public_sharing
 when 'neighborhood' then g.neighborhood else true end);
$$;
create function public.privacy_state(p_child uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.signup_privacy_choices; declared boolean; owner boolean:=false; begin
 if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into c from public.signup_privacy_choices where user_id=auth.uid() and version=public.current_signup_privacy_version();
 declared:=public.guardian_declared(auth.uid());
 if p_child is not null then
  if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
  select public.is_family_owner(k.family_id) into owner from public.children k where k.id=p_child;
 end if;
 return jsonb_build_object('version',public.current_signup_privacy_version(),'authority',coalesce(c.authority,false),
 'health',case when p_child is null then coalesce(c.health,false) else public.child_privacy_allowed(p_child,'health') end,
 'publicSharing',case when p_child is null then coalesce(c.public_sharing,false) else public.child_privacy_allowed(p_child,'public') end,
 'neighborhood',case when p_child is null then coalesce(c.neighborhood,false) else public.child_privacy_allowed(p_child,'neighborhood') end,
 'childGranted',case when p_child is null then declared else public.child_privacy_allowed(p_child,'child') end,'owner',owner);
end $$;

create function public.child_record_contains_health(p public.child_records) returns boolean
language sql immutable set search_path='' as $$ select
 p.kind in ('measurement','hospital','temperature','medication') or p.height_cm is not null or p.weight_kg is not null or p.head_cm is not null
 or p.stool_color is not null or p.stool_texture is not null or p.temperature_c is not null
 or nullif(p.medicine_name,'') is not null or p.dose_amount is not null or p.dose_unit is not null; $$;

create function public.require_child_privacy() returns trigger
language plpgsql security definer set search_path='' as $$
declare child uuid; health boolean:=false; data jsonb:=to_jsonb(new); begin
 -- Trusted service imports may store fixtures but never manufacture acceptance evidence.
 if auth.role()='service_role' or auth.uid() is null then return new; end if;
 if tg_table_name='children' then
  if tg_op='INSERT' then
   if not public.guardian_declared(auth.uid()) then raise exception 'authority_declaration_required' using errcode='42501'; end if;
   return new;
  end if;
  child:=new.id;
 else child:=(data->>'child_id')::uuid; end if;
 if not public.child_privacy_allowed(child,'child') then raise exception 'child_consent_required' using errcode='42501'; end if;
 if tg_table_name='child_records' then health:=public.child_record_contains_health(new);
 elsif tg_table_name='vaccination_records' then health:=true;
 elsif tg_table_name='events' then health:=data->>'event_kind' in ('hospital','medication'); end if;
 if health and not public.child_privacy_allowed(child,'health') then raise exception 'health_consent_required' using errcode='42501'; end if;
 return new;
end $$;
create function public.bind_inserted_child_privacy() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is not null and auth.role() is distinct from 'service_role' then
  insert into public.child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
  select new.id,user_id,version,child_information,authority,health,public_sharing,neighborhood
  from public.signup_privacy_choices where user_id=auth.uid() and public.guardian_declared(auth.uid());
 end if;
 return new;
end $$;
create trigger child_privacy_guard before insert or update on public.children for each row execute function public.require_child_privacy();
create trigger child_privacy_bind after insert on public.children for each row execute function public.bind_inserted_child_privacy();
create trigger care_privacy_guard before insert or update on public.care_records for each row execute function public.require_child_privacy();
create trigger record_privacy_guard before insert or update on public.child_records for each row execute function public.require_child_privacy();
create trigger vaccine_privacy_guard before insert or update on public.vaccination_records for each row execute function public.require_child_privacy();
create trigger event_privacy_guard before insert or update on public.events for each row execute function public.require_child_privacy();
create trigger task_privacy_guard before insert or update on public.tasks for each row execute function public.require_child_privacy();
create trigger photo_privacy_guard before insert or update on public.child_record_photos for each row execute function public.require_child_privacy();

create function public.require_public_child_privacy() returns trigger
language plpgsql security definer set search_path='' as $$
declare child uuid; begin
 if tg_table_name='growth_diary_shares' then
  if not (new.everyone or new.same_birth_date) then return new; end if;
  select child_id into child from public.child_records where id=new.record_id;
 else child:=new.child_id; end if;
 if not public.child_privacy_allowed(child,'public') then raise exception 'public_sharing_consent_required' using errcode='42501'; end if;
 return new;
end $$;
create trigger diary_public_privacy_guard before insert or update on public.growth_diary_shares for each row execute function public.require_public_child_privacy();
create trigger diary_link_privacy_guard before insert or update on public.child_diary_links for each row execute function public.require_public_child_privacy();
create function public.require_neighborhood_child_privacy() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if tg_table_name='parenting_playground_reactions' then
  if not public.child_privacy_allowed(new.sender_child,'neighborhood') or not public.child_privacy_allowed(new.receiver_child,'neighborhood')
  then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 elsif not public.child_privacy_allowed(new.child_id,'neighborhood') then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 return new;
end $$;
create trigger playground_position_privacy_guard before insert or update on public.parenting_playground_positions for each row execute function public.require_neighborhood_child_privacy();
create trigger playground_profile_privacy_guard before insert or update on public.parenting_friend_profiles for each row execute function public.require_neighborhood_child_privacy();
create trigger playground_reaction_privacy_guard before insert or update on public.parenting_playground_reactions for each row execute function public.require_neighborhood_child_privacy();

create function public.update_health_consent(p_health boolean,p_confirmation text default '') returns void
language plpgsql security definer set search_path='' as $$
declare c public.signup_privacy_choices; owned uuid[]; begin
 if not public.has_signup_agreement() or not public.guardian_declared(auth.uid()) then raise exception 'authority_declaration_required' using errcode='42501'; end if;
 if p_health is null then raise exception 'invalid privacy choices' using errcode='22023'; end if;
 select * into c from public.signup_privacy_choices where user_id=auth.uid() for update;
 select coalesce(array_agg(g.child_id),'{}') into owned from public.child_privacy_consents g
 join public.children k on k.id=g.child_id join public.family_members m on m.family_id=k.family_id and m.user_id=g.accepted_by
 where g.accepted_by=auth.uid() and g.version=c.version and g.withdrawn_at is null and public.can_write_child(k.id);
 if c.health and not p_health and (
 exists(select 1 from public.child_records r where r.child_id=any(owned) and public.child_record_contains_health(r))
 or exists(select 1 from public.vaccination_records where child_id=any(owned))
 or exists(select 1 from public.events where child_id=any(owned) and event_kind in ('hospital','medication'))) then
  if p_confirmation is distinct from 'DELETE HEALTH RECORDS' then raise exception 'health_records_confirmation_required' using errcode='22023'; end if;
  perform public.require_recent_login();
  -- Keep a diary's text and photographs; withdraw only its structured measurements.
  update public.child_records set kind='observation',weight_kg=null,height_cm=null,head_cm=null
  where child_id=any(owned) and service='growth' and (weight_kg is not null or height_cm is not null or head_cm is not null);
  delete from public.child_records r where r.child_id=any(owned) and r.service<>'growth' and public.child_record_contains_health(r);
  delete from public.vaccination_records where child_id=any(owned);
  delete from public.events where child_id=any(owned) and event_kind in ('hospital','medication');
 end if;
 update public.signup_privacy_choices set health=p_health,updated_at=clock_timestamp() where user_id=auth.uid();
 update public.child_privacy_consents set health=p_health where accepted_by=auth.uid() and version=c.version and withdrawn_at is null;
end $$;

create table public.child_visibility_choices (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check(scope in ('public','neighborhood')),
 enabled boolean not null,
 version text not null,
 accepted_at timestamptz not null default clock_timestamp()
);
create index child_visibility_history on public.child_visibility_choices(child_id,accepted_at desc);
alter table public.child_visibility_choices enable row level security;
revoke all on public.child_visibility_choices from public,anon,authenticated;
grant all on public.child_visibility_choices to service_role;
create function public.set_child_visibility(p_child uuid,p_scope text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.signup_privacy_choices; g public.child_privacy_consents; begin
 if not public.account_active() or not public.can_write_child(p_child) or not public.guardian_declared(auth.uid())
 then raise exception 'forbidden' using errcode='42501'; end if;
 if p_scope is null or p_scope not in ('public','neighborhood') or p_enabled is null then raise exception 'invalid visibility' using errcode='22023'; end if;
 perform 1 from public.children where id=p_child for update;
 select * into c from public.signup_privacy_choices where user_id=auth.uid();
 select * into g from public.child_privacy_consents where child_id=p_child and accepted_by=auth.uid() and version=c.version;
 if p_enabled and g.child_id is not null and g.withdrawn_at is null
 and (case p_scope when 'public' then g.public_sharing else g.neighborhood end) then return; end if;
 insert into public.child_privacy_consents(child_id,accepted_by,version,child_information,authority,health,public_sharing,neighborhood)
 values(p_child,auth.uid(),c.version,true,true,c.health,p_scope='public' and p_enabled,p_scope='neighborhood' and p_enabled)
 on conflict(child_id,accepted_by,version) do update set
 public_sharing=case when p_scope='public' then p_enabled else child_privacy_consents.public_sharing end,
 neighborhood=case when p_scope='neighborhood' then p_enabled else child_privacy_consents.neighborhood end,withdrawn_at=null;
 if not p_enabled then
  if p_scope='public' then
   update public.child_privacy_consents set public_sharing=false where child_id=p_child;
   delete from public.child_diary_links where child_id=p_child;
   update public.growth_diary_shares set everyone=false,same_birth_date=false where record_id in(select id from public.child_records where child_id=p_child);
  else
   update public.child_privacy_consents set neighborhood=false where child_id=p_child;
   delete from public.parenting_playground_positions where child_id=p_child;
   delete from public.parenting_friend_profiles where child_id=p_child;
   delete from public.parenting_playground_reactions where sender_child=p_child or receiver_child=p_child;
  end if;
 end if;
 insert into public.child_visibility_choices(child_id,user_id,scope,enabled,version) values(p_child,auth.uid(),p_scope,p_enabled,c.version);
end $$;
revoke all on function public.set_child_visibility(uuid,text,boolean) from public,anon;
grant execute on function public.set_child_visibility(uuid,text,boolean) to authenticated;

create or replace function public.save_growth_diary(
 p_id uuid, p_child uuid, p_data jsonb, p_private boolean default true,
 p_version integer default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; child_sex text; removed uuid[];
begin
 if p_private is null then raise exception 'invalid privacy' using errcode='22023'; end if;
 saved := public.save_child_record(p_id,p_child,'growth',p_data,p_version);
 -- The version check and deletions share the diary save transaction.
 if p_data ? 'removed_photo_ids' then
  if jsonb_typeof(p_data->'removed_photo_ids') <> 'array' then
   raise exception 'invalid photo removal' using errcode='22023';
  end if;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into removed
  from jsonb_array_elements_text(p_data->'removed_photo_ids');
  if cardinality(removed)>9
   or cardinality(removed)<>(select count(distinct id) from unnest(removed) id)
   or (cardinality(removed)>0 and p_version is null)
   or exists(select 1 from unnest(removed) requested(id)
    where not exists(select 1 from public.child_record_photos p where p.id=requested.id and p.record_id=saved))
  then raise exception 'invalid photo removal' using errcode='22023'; end if;
  delete from public.child_record_photos where record_id=saved and id=any(removed);
 end if;
 select sex into child_sex from public.children where id=p_child;
 perform public.share_growth_diary(saved,not p_private,not p_private,coalesce(child_sex,''));
 return saved;
end $$;

-- Replace the live projections themselves: no unchecked legacy aliases.
create or replace function public.growth_diary_feed(p_child uuid,p_scope text,p_page integer default 0,p_age integer default null)
returns table(id uuid,nickname text,age_days integer,sex text,note text,weight_kg numeric,height_cm numeric,head_cm numeric,photo_ids uuid[],recorded_date date,author_relationship text)
language plpgsql stable security definer set search_path='' as $$
declare birthday date;
begin
 if not public.account_active() or not public.community_participant() or not public.can_read_child(p_child) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_scope not in ('birth','all') or p_scope is null or p_page is null or p_page<0 or p_page>10000 or p_age<0 then
  raise exception 'invalid feed' using errcode='22023';
 end if;
 select birth_date into birthday from public.children where children.id=p_child;
 return query select r.id,c.name,
 (r.occurred_at at time zone r.record_timezone)::date-c.birth_date,c.sex,r.note,
 case when p_scope='birth' then r.weight_kg end,
 case when p_scope='birth' then r.height_cm end,
 case when p_scope='birth' then r.head_cm end,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.sort_order,p.created_at,p.id),
 (r.occurred_at at time zone r.record_timezone)::date,r.author_relationship::text
 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where public.child_privacy_allowed(r.child_id,'public') and (not public.child_record_contains_health(r) or public.child_privacy_allowed(r.child_id,'health')) and not s.hidden and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and ((p_scope='birth' and s.same_birth_date and c.birth_date=birthday) or (p_scope='all' and s.everyone))
 and (p_scope='all' or p_age is null or (r.occurred_at at time zone r.record_timezone)::date-c.birth_date=p_age)
 order by r.occurred_at desc,r.id limit 21 offset p_page*20;
end $$;

create or replace function public.growth_diary_photo_allowed(p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and public.community_participant() and exists(
 select 1 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where public.child_privacy_allowed(r.child_id,'public') and (not public.child_record_contains_health(r) or public.child_privacy_allowed(r.child_id,'health')) and not s.hidden and s.record_id=p_record and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and (s.everyone or (s.same_birth_date and exists(
 select 1 from public.children viewer where viewer.birth_date=c.birth_date and public.can_read_child(viewer.id)))));
$$;

create or replace function public.growth_diary_cohort_visible(p_child uuid,p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and public.community_participant() and public.can_read_child(p_child) and exists(
 select 1 from public.child_records r join public.children c on c.id=r.child_id
 join public.children viewer on viewer.id=p_child and viewer.birth_date=c.birth_date
 join public.growth_diary_shares s on s.record_id=r.id
 where public.child_privacy_allowed(r.child_id,'public') and (not public.child_record_contains_health(r) or public.child_privacy_allowed(r.child_id,'health')) and r.id=p_record and r.service='growth' and s.same_birth_date and not s.hidden
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by));
$$;

create or replace function public.diary_link_child(p_token text) returns uuid
language sql stable security definer set search_path='' as $$
 select c.id from public.child_diary_links l join public.children c on c.id=l.child_id
 where public.child_privacy_allowed(c.id,'public') and l.token=p_token
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=l.created_by)
 and exists(select 1 from public.family_members m where m.family_id=c.family_id and m.user_id=l.created_by
 and (m.role='owner' or (m.role='editor' and exists(select 1 from public.child_access a where a.child_id=c.id and a.user_id=l.created_by and a.role='editor'))));
$$;

create or replace function public.child_diary_link_records(p_token text) returns setof uuid
language sql stable security definer set search_path='' as $$
 select r.id from public.child_records r join public.growth_diary_shares s on s.record_id=r.id
 where (not public.child_record_contains_health(r) or public.child_privacy_allowed(r.child_id,'health')) and r.child_id=public.diary_link_child(p_token) and r.service='growth'
 and s.everyone and not s.hidden and r.occurred_at<=now()
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and exists(select 1 from public.profiles p where p.id=s.published_by and p.consented_at is not null);
$$;

create or replace function public.manage_child_diary_link(p_child uuid,p_action text) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform 1 from public.children where id=p_child for update;
 if not found or not public.account_active() or not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action='revoke' then delete from public.child_diary_links where child_id=p_child; return null;
 elsif p_action in ('create','rotate') then
  perform public.set_child_visibility(p_child,'public',true);
  if p_action='rotate' then delete from public.child_diary_links where child_id=p_child; end if;
  insert into public.child_diary_links(child_id,created_by) values(p_child,auth.uid()) on conflict(child_id) do nothing;
 elsif p_action is distinct from 'get' then raise exception 'invalid action' using errcode='22023'; end if;
 select token into result from public.child_diary_links where child_id=p_child;
 return result;
end $$;

create or replace function public.share_growth_diary(p_record uuid,p_same_birth_date boolean,p_everyone boolean,p_sex text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.child_records; c public.children;
begin
 select * into r from public.child_records where id=p_record;
 if r.id is null or r.service<>'growth' or not public.account_active() or not public.can_write_child(r.child_id) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select * into c from public.children where id=r.child_id for update;
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_same_birth_date or p_everyone then
  perform public.set_child_visibility(r.child_id,'public',true);
  if not public.community_can_write() then raise exception 'forbidden' using errcode='42501'; end if;
  if c.birth_date is null or (r.occurred_at at time zone r.record_timezone)::date<c.birth_date or r.occurred_at>now() then
   raise exception 'birth date required' using errcode='22023';
  end if;
 end if;
 -- A privacy-reducing action does not mutate child data or require renewed consent.
 if (p_same_birth_date or p_everyone) and nullif(p_sex,'') is not null and p_sex is distinct from c.sex then
  update public.children set sex=p_sex where id=r.child_id;
 end if;
 insert into public.growth_diary_shares(record_id,same_birth_date,everyone,published_by)
 values(p_record,p_same_birth_date,p_everyone,auth.uid())
 on conflict(record_id) do update set same_birth_date=excluded.same_birth_date,everyone=excluded.everyone,
 published_by=excluded.published_by,updated_at=now();
 insert into public.audit_events(family_id,actor_id,action,subject_id)
 values(c.family_id,auth.uid(),'growth_sharing_updated',r.id);
end $$;

create or replace function public.parenting_playground(p_child uuid,p_left integer default null,p_right integer default null,p_day text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.children; f public.families; r public.parenting_playground_regions; own public.parenting_friend_profiles; pos public.parenting_playground_positions;
 today date; rid uuid; idx integer; col integer; lane integer; seed integer; lx integer; rx integer; lo integer; hi integer; n integer; members jsonb; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not public.child_privacy_allowed(p_child,'neighborhood') then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 if (p_left is null)<>(p_right is null) or (p_left is not null and (abs(p_left::bigint)>100000000 or abs(p_right::bigint)>100000000 or p_right<p_left or p_right::bigint-p_left>4096)) then raise exception 'invalid viewport' using errcode='22023'; end if;
 select * into c from public.children where id=p_child; select * into f from public.families where id=c.family_id;
 rid:=public.playground_region(f.id); select * into own from public.parenting_friend_profiles where child_id=p_child;
 if rid is null then
  return jsonb_build_object('day',(now() at time zone 'UTC')::date,'timezone','UTC','expires_at',((date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC'),
   'width',680,'min_x',-340,'max_x',340,'height',520,'population',1,'left',-340,'right',340,
   'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,current_date-c.birth_date),'x',0,'y',355),'members','[]'::jsonb);
 end if;
 select * into r from public.parenting_playground_regions where id=rid; today:=(now() at time zone r.timezone)::date;
 select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
 if not found and c.birth_date<=today and c.birth_date>(today-interval '7 years')::date then
  -- Serialize first arrivals per neighborhood/day. Existing rows are never moved.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rid::text||today::text,0));
  select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
  if not found then
   select coalesce(max(slot)+1,0) into idx from public.parenting_playground_positions where region_id=rid and day=today;
   col:=idx/3; col:=case when col%2=1 then (col+1)/2*240 else -col/2*240 end; lane:=idx%3;
   seed:=('x'||substr(md5(rid::text||today::text||p_child::text),1,7))::bit(28)::integer;
   insert into public.parenting_playground_positions(region_id,day,child_id,slot,x,y)
    values(rid,today,p_child,idx,col+case lane when 1 then -55 when 2 then 55 else 0 end+seed%49-24,
    case lane when 1 then 275 when 2 then 435 else 355 end+(seed/53)%23-11) returning * into pos;
   -- Opportunistic bounded cleanup: no scheduled task or full-table sweep.
   delete from public.parenting_playground_positions where (region_id,day,child_id) in
    (select region_id,day,child_id from public.parenting_playground_positions where created_at<now()-interval '8 days' order by created_at limit 100);
  end if;
 end if;
 select least(-340,coalesce(min(x),0)-160),greatest(340,coalesce(max(x),0)+160) into lo,hi from public.parenting_playground_positions where region_id=rid and day=today and public.child_privacy_allowed(child_id,'neighborhood');
 select count(*) into n from public.parenting_playground_positions s join public.children k on k.id=s.child_id join public.families cf on cf.id=k.family_id
 where public.child_privacy_allowed(k.id,'neighborhood') and s.region_id=rid and s.day=today and cf.merged_into is null and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date
 and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province);
 lx:=case when p_day=today::text and p_left is not null then p_left else coalesce(pos.x,0)-1000 end;
 rx:=case when p_day=today::text and p_right is not null then p_right else coalesce(pos.x,0)+1000 end;
 select coalesce(jsonb_agg(a.item order by a.y,a.id),'[]'::jsonb) into members from (
  select coalesce(p.id,md5(rid::text||k.id::text)::uuid) id,s.y,jsonb_build_object('id',coalesce(p.id,md5(rid::text||k.id::text)::uuid),'nickname',concat_ws(' ',trim(cf.name),trim(k.name)),'status',coalesce(p.status,''),'sex',k.sex,'age_days',today-k.birth_date,'x',s.x,'y',s.y) item
  from public.parenting_playground_positions s join public.children k on k.id=s.child_id left join public.parenting_friend_profiles p on p.child_id=k.id join public.families cf on cf.id=k.family_id
  where public.child_privacy_allowed(k.id,'neighborhood') and s.region_id=rid and s.day=today and s.x between lx and rx and k.id<>p_child
  and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date and cf.merged_into is null
  and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province)
  order by s.x,s.child_id limit 150
 ) a;
 return jsonb_build_object('day',today,'timezone',r.timezone,'expires_at',(today+1)::timestamp at time zone r.timezone,
 'width',hi-lo,'min_x',lo,'max_x',hi,'height',520,'population',n,'left',lx,'right',rx,
 'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,today-c.birth_date),'x',coalesce(pos.x,0),'y',coalesce(pos.y,355)), 'members',members);
end $$;

create or replace function public.parenting_friends(p_family uuid,p_scope text default 'locality',p_place text default '',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,nickname text,status text,sex text,age_days integer,area_label text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare home public.families; today date; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_scope is distinct from 'locality' or p_place is distinct from '' then raise exception 'home locality only' using errcode='22023'; end if;
 select * into home from public.families where families.id=p_family;
 if home.merged_into is not null or nullif(home.residence_country_code,'') is null or nullif(home.residence_city,'') is null or nullif(home.residence_locality,'') is null then return; end if;
 select (now() at time zone timezone)::date into today from public.profiles where profiles.id=auth.uid();
 return query select p.id,p.nickname,p.status,c.sex,today-c.birth_date,home.residence_locality,p.created_at
 from public.parenting_friend_profiles p join public.children c on c.id=p.child_id join public.families f on f.id=c.family_id
 where public.child_privacy_allowed(c.id,'neighborhood') and f.merged_into is null and c.birth_date<=today and c.birth_date>(today-interval '7 years')::date
 and f.residence_country_code=home.residence_country_code and f.residence_city=home.residence_city and f.residence_locality=home.residence_locality
 and (home.residence_country_code='KR' or coalesce(f.residence_province,'')=coalesce(home.residence_province,''))
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 30;
end $$;

create or replace function public.send_playground_reaction(p_child uuid,p_friend uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.children; f public.families; rid uuid; today date; target uuid; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not public.child_privacy_allowed(p_child,'neighborhood') then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('wave','heart','comfort') then raise exception 'invalid reaction' using errcode='22023'; end if;
 select * into c from public.children where id=p_child;
 select * into f from public.families where id=c.family_id and merged_into is null;
 rid:=public.playground_region(c.family_id);
 select (now() at time zone r.timezone)::date into today from public.parenting_playground_regions r where r.id=rid;
 if rid is null or f.id is null or c.birth_date>today or c.birth_date<=(today-interval '7 years')::date
 or not exists(select 1 from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child)
 then raise exception 'forbidden' using errcode='42501'; end if;
 select k.id into target from public.parenting_playground_positions s
 join public.children k on k.id=s.child_id join public.families cf on cf.id=k.family_id
 left join public.parenting_friend_profiles p on p.child_id=k.id
 where public.child_privacy_allowed(k.id,'neighborhood') and s.region_id=rid and s.day=today and k.id<>p_child
 and coalesce(p.id,md5(rid::text||k.id::text)::uuid)=p_friend
 and cf.merged_into is null and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date
 and cf.residence_country_code=f.residence_country_code and cf.residence_city=f.residence_city and cf.residence_locality=f.residence_locality
 and (f.residence_country_code='KR' or coalesce(cf.residence_province,'')=coalesce(f.residence_province,''));
 if target is null then raise exception 'friend unavailable' using errcode='22023'; end if;
 insert into public.parenting_playground_reactions(sender_child,receiver_child,day,kind,sender_name)
 values(p_child,target,today,p_kind,concat_ws(' ',trim(f.name),trim(c.name))) on conflict(sender_child,receiver_child,day,kind) do nothing;
 -- Lazy, bounded cleanup replaces a daily scheduler.
 delete from public.parenting_playground_reactions where id in
 (select id from public.parenting_playground_reactions where created_at<now()-interval '2 days' order by created_at limit 100);
end $$;

create or replace function public.playground_reactions(p_child uuid,p_before uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rid uuid; today date; items jsonb; cursor_time timestamptz; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 select public.playground_region(c.family_id) into rid from public.children c where c.id=p_child;
 select (now() at time zone r.timezone)::date into today from public.parenting_playground_regions r where r.id=rid;
 today:=coalesce(today,(now() at time zone 'UTC')::date);
 if not public.child_privacy_allowed(p_child,'neighborhood') then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 if p_before is not null then
  select created_at into cursor_time from public.parenting_playground_reactions where id=p_before and receiver_child=p_child and day=today;
  if not found then return jsonb_build_object('day',today,'items','[]'::jsonb); end if;
 end if;
 select coalesce(jsonb_agg(a.item order by a.created_at desc,a.id desc),'[]'::jsonb) into items from (
  select id,created_at,jsonb_build_object('id',id,'name',sender_name,'kind',kind,'created_at',created_at) item
  from public.parenting_playground_reactions where public.child_privacy_allowed(sender_child,'neighborhood') and receiver_child=p_child and day=today
  and (p_before is null or (created_at,id)<(cursor_time,p_before)) order by created_at desc,id desc limit 21
 ) a;
 return jsonb_build_object('day',today,'items',items);
end $$;

revoke all on function public.current_signup_privacy_version(),public.guardian_declared(uuid),public.bind_declared_children(uuid),
 public.child_privacy_allowed(uuid,text),public.child_record_contains_health(public.child_records),public.require_child_privacy(),
 public.bind_inserted_child_privacy(),public.require_public_child_privacy(),public.require_neighborhood_child_privacy()
 from public,anon,authenticated;
revoke all on function public.accept_signup_agreements(text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean),public.privacy_state(uuid),public.update_health_consent(boolean,text) from public,anon;
grant execute on function public.accept_signup_agreements(text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean),public.privacy_state(uuid),public.update_health_consent(boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
