begin;
-- User-requested one-time backfill; new registrations must select a value.
update public.children set sex='female' where sex is null;
alter table public.children alter column sex set not null;
drop function public.create_family_with_child(text,text,date,date);
create function public.create_family_with_child(p_family_name text,p_child_name text,p_due_date date,p_birth_date date,p_sex text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid; cid uuid;
begin
  if p_sex is null or p_sex not in ('female','male') then raise exception 'sex_required' using errcode='22023'; end if;
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and consented_at is not null for update;
  if not found then raise exception 'consent_required'; end if;
  select c.id into cid from public.children c join public.family_members m on m.family_id=c.family_id
    where m.user_id=auth.uid() and m.role='owner' order by c.created_at limit 1;
  if cid is not null then return cid; end if;
  insert into public.families(name) values(p_family_name) returning id into fid;
  insert into public.family_members values(fid,auth.uid(),'owner');
  insert into public.children(family_id,name,due_date,birth_date,sex) values(fid,p_child_name,p_due_date,p_birth_date,p_sex) returning id into cid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'family_created',cid);
  return cid;
end $$;

revoke all on function public.create_family_with_child(text,text,date,date,text) from public,anon;
grant execute on function public.create_family_with_child(text,text,date,date,text) to authenticated;
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
  if not public.community_can_write() then raise exception 'forbidden' using errcode='42501'; end if;
  if c.birth_date is null or (r.occurred_at at time zone r.record_timezone)::date<c.birth_date or r.occurred_at>now() then
   raise exception 'birth date required' using errcode='22023';
  end if;
 end if;
 update public.children set sex=coalesce(nullif(p_sex,''),c.sex) where id=r.child_id;
 insert into public.growth_diary_shares(record_id,same_birth_date,everyone,published_by)
 values(p_record,p_same_birth_date,p_everyone,auth.uid())
 on conflict(record_id) do update set same_birth_date=excluded.same_birth_date,everyone=excluded.everyone,
 published_by=excluded.published_by,updated_at=now();
 insert into public.audit_events(family_id,actor_id,action,subject_id)
 values(c.family_id,auth.uid(),'growth_sharing_updated',r.id);
end $$;

commit;
