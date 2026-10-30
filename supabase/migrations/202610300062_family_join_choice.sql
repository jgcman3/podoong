begin;

-- Keep the old family metadata/history, linked to the surviving family.
-- Child identities and their dependent records/photos never change.
alter table public.families add column merged_into uuid references public.families(id) on delete cascade;
alter table public.families add constraint family_merge_not_self check (merged_into is null or merged_into<>id);
create index families_merged_into_idx on public.families(merged_into) where merged_into is not null;
-- A former uploader leaving the service must not delete photos that now belong
-- to the shared child's surviving records. Record deletion still queues all
-- original/display files through the existing child-photo trigger.
alter table public.child_record_photos drop constraint child_record_photos_uploaded_by_fkey;
alter table public.child_record_photos alter column uploaded_by drop not null;
alter table public.child_record_photos add constraint child_record_photos_uploaded_by_fkey
  foreign key(uploaded_by) references public.profiles(id) on delete set null;
create or replace function public.queue_profile_child_photos() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.child_record_photos p using public.children c,public.family_members m
    where p.uploaded_by=old.id and p.child_id=c.id and m.family_id=c.family_id
      and m.user_id=old.id and m.role='owner';
  insert into public.child_photo_cleanup(path)
    select o.name from storage.objects o
    where o.bucket_id='child-care-photos' and split_part(o.name,'/',1)=old.id::text
      and not exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(o.name))
    on conflict do nothing;
  return old;
end $$;
create or replace function public.account_has_storage(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from storage.objects o where split_part(o.name,'/',1)=p_user::text and (
    o.bucket_id='community-photos' or (o.bucket_id='child-care-photos'
      and not exists(select 1 from public.child_record_photos p join public.children c on c.id=p.child_id
        where p.path=public.child_photo_original_path(o.name) and not exists(
          select 1 from public.family_members m where m.family_id=c.family_id and m.user_id=p_user and m.role='owner')))
  ));
$$;
alter table public.child_access drop constraint child_access_child_id_family_id_fkey;
alter table public.child_access add constraint child_access_child_id_family_id_fkey
  foreign key(child_id,family_id) references public.children(id,family_id) on update cascade on delete cascade;
alter table public.invitations drop constraint invitations_child_id_family_id_fkey;
alter table public.invitations add constraint invitations_child_id_family_id_fkey
  foreign key(child_id,family_id) references public.children(id,family_id) on update cascade on delete cascade;

-- A bearer invitation only reveals its destination and the caller's own families.
create function public.family_join_preview(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.invitations; sources jsonb; target jsonb;
begin
  if auth.uid() is null or not public.account_active() then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into inv from public.invitations
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=clock_timestamp() then
    raise exception 'invalid_invitation';
  end if;
  select jsonb_build_object('id',f.id,'name',f.name,'child_name',c.name,'role',inv.role)
    into target from public.families f join public.children c on c.family_id=f.id
    where f.id=inv.family_id and c.id=inv.child_id;
  select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) into sources from (
    select jsonb_build_object(
      'id',f.id,'name',f.name,'role',m.role,
      'other_members',(select count(*) from public.family_members x where x.family_id=f.id and x.user_id<>auth.uid()),
      'children',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.id)
        from public.children c where c.family_id=f.id and (m.role='owner' or public.can_read_child(c.id))),'[]'::jsonb)
    ) item from public.family_members m join public.families f on f.id=m.family_id
    where m.user_id=auth.uid() and m.family_id<>inv.family_id
  ) s;
  return jsonb_build_object('target',target,'sources',sources,
    'revision',encode(extensions.digest((jsonb_build_object('invitation',inv.id,'target',target,'sources',sources))::text,'sha256'),'hex'),
    'blocked',exists(select 1 from jsonb_array_elements(sources) s where s->>'role'='owner' and (s->>'other_members')::integer>0)
      or (inv.role='viewer' and exists(select 1 from jsonb_array_elements(sources) s where s->>'role'='owner')));
end $$;

create function public.merge_family_from_invitation(
  p_token text,p_relationship public.caregiver_relationship,p_revision text,p_confirmation text
) returns uuid language plpgsql security definer set search_path='' as $$
declare preview jsonb; cid uuid; source jsonb; target_id uuid; source_id uuid;
begin
  if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  perform 1 from public.families f where f.id in (
    select family_id from public.family_members where user_id=auth.uid()
    union select family_id from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
  ) order by f.id for update;
  preview:=public.family_join_preview(p_token);
  if p_revision is distinct from preview->>'revision' then raise exception 'family_scope_changed' using errcode='40001'; end if;
  if (preview->>'blocked')::boolean then raise exception 'family_merge_blocked' using errcode='23514'; end if;
  if jsonb_array_length(preview->'sources')=0 then return public.accept_invitation(p_token,p_relationship); end if;
  if p_confirmation is distinct from 'MERGE FAMILY' then raise exception 'confirmation_required' using errcode='22023'; end if;
  perform public.require_recent_login();
  cid:=public.accept_invitation_before_relationship(p_token);
  target_id:=(preview->'target'->>'id')::uuid;
  update public.family_members set relationship=p_relationship where family_id=target_id and user_id=auth.uid();
  for source in select * from jsonb_array_elements(preview->'sources') loop
    if source->>'role'='owner' then
      source_id:=(source->>'id')::uuid;
      -- A previous invitation must not silently grant access to the new family.
      update public.invitations set revoked_at=coalesce(revoked_at,clock_timestamp())
        where family_id=source_id and accepted_at is null;
      update public.children set family_id=target_id where family_id=source_id;
      insert into public.child_access(child_id,family_id,user_id,role)
        select c.id,target_id,auth.uid(),'editor' from public.children c
        where c.id in (select (v->>'id')::uuid from jsonb_array_elements(source->'children') v)
        on conflict(child_id,user_id) do update set role='editor';
      update public.families set merged_into=target_id where id=source_id;
      delete from public.family_members where family_id=source_id and user_id=auth.uid();
    end if;
    -- Other people's families and the caller's caregiver access remain intact.
  end loop;
  insert into public.audit_events(family_id,actor_id,action,subject_id)
    values(target_id,auth.uid(),'family_merged',cid);
  return cid;
end $$;

-- Archived source families must not count as additional neighborhood applicants.
alter function public.neighborhood_region(uuid) rename to neighborhood_region_before_family_merge;
revoke all on function public.neighborhood_region_before_family_merge(uuid) from public,anon,authenticated;
create function public.neighborhood_region(p_family uuid) returns text
language sql stable security definer set search_path='' as $$
  select public.neighborhood_region_before_family_merge(p_family)
  where exists(select 1 from public.families where id=p_family and merged_into is null);
$$;
revoke all on function public.neighborhood_region(uuid) from public,anon;
grant execute on function public.neighborhood_region(uuid) to authenticated;

-- Existing families go through the reviewed merge flow instead of silently
-- creating a second membership with no explanation of their existing children.
create or replace function public.accept_invitation(p_token text,p_relationship public.caregiver_relationship)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; preview jsonb;
begin
  if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  preview:=public.family_join_preview(p_token);
  perform 1 from public.families where id=(preview->'target'->>'id')::uuid for update;
  if jsonb_array_length(preview->'sources')>0 then raise exception 'family_switch_confirmation_required'; end if;
  cid:=public.accept_invitation_before_relationship(p_token);
  update public.family_members m set relationship=p_relationship from public.children c
    where c.id=cid and m.family_id=c.family_id and m.user_id=auth.uid();
  return cid;
end $$;

-- Prevent a new registration from creating another family when it already
-- belongs to one. Serialize this with invitation acceptance on the profile row.
create or replace function public.create_family_with_child(
  p_family_name text,p_child_name text,p_birth_date date,p_sex text,p_relationship public.caregiver_relationship
) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
  if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
  if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and consented_at is not null for update;
  if not found then raise exception 'consent_required'; end if;
  select c.id into cid from public.children c join public.family_members m on m.family_id=c.family_id
    where m.user_id=auth.uid() and public.can_read_child(c.id) order by c.created_at,c.id limit 1;
  if cid is not null then return cid; end if;
  if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'family_already_exists'; end if;
  cid:=public.create_family_with_child_before_relationship(p_family_name,p_child_name,p_birth_date,p_sex);
  update public.family_members m set relationship=p_relationship from public.children c
    where c.id=cid and m.family_id=c.family_id and m.user_id=auth.uid();
  return cid;
end $$;

revoke all on function public.family_join_preview(text),public.merge_family_from_invitation(text,public.caregiver_relationship,text,text) from public,anon;
grant execute on function public.family_join_preview(text),public.merge_family_from_invitation(text,public.caregiver_relationship,text,text) to authenticated;
commit;
