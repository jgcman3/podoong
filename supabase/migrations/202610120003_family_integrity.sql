create or replace function public.create_family_with_child(p_family_name text,p_child_name text,p_due_date date,p_birth_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid; cid uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and consented_at is not null for update;
  if not found then raise exception 'consent_required'; end if;
  select c.id into cid from public.children c join public.family_members m on m.family_id=c.family_id
    where m.user_id=auth.uid() and m.role='owner' order by c.created_at limit 1;
  if cid is not null then return cid; end if;
  insert into public.families(name) values(p_family_name) returning id into fid;
  insert into public.family_members values(fid,auth.uid(),'owner');
  insert into public.children(family_id,name,due_date,birth_date) values(fid,p_child_name,p_due_date,p_birth_date) returning id into cid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'family_created',cid);
  return cid;
end $$;

create function public.list_caregivers(p_child_id uuid) returns table(user_id uuid,display_name text,role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_read_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  return query select m.user_id,p.display_name,case when m.role='owner' then m.role else a.role end
    from public.children c join public.family_members m on m.family_id=c.family_id
    join public.profiles p on p.id=m.user_id left join public.child_access a on a.child_id=c.id and a.user_id=m.user_id
    where c.id=p_child_id and (m.role='owner' or a.child_id is not null);
end $$;
revoke execute on function public.list_caregivers(uuid) from public,anon;
grant execute on function public.list_caregivers(uuid) to authenticated;

create or replace function public.save_task(p_id uuid,p_child_id uuid,p_title text,p_service text,p_due_date date,p_status text,p_assignee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from unnest(array['pregnancy','birth','administration','postpartum','feeding','sleep','diaper','food','growth','health','vaccination','support','nursery','kindergarten','school','community','polls']) s where s=p_service) then raise exception 'invalid_service'; end if;
  perform 1 from public.children where id=p_child_id for update;
  if p_assignee_id is not null and not exists(select 1 from public.family_members m join public.children c on c.family_id=m.family_id
    where c.id=p_child_id and m.user_id=p_assignee_id and (m.role='owner' or exists(select 1 from public.child_access a where a.child_id=p_child_id and a.user_id=p_assignee_id))) then raise exception 'invalid_assignee'; end if;
  if exists(select 1 from public.tasks where id=p_id and child_id<>p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.tasks(id,child_id,title,service,due_date,status,assignee_id,created_by)
    values(p_id,p_child_id,p_title,p_service,p_due_date,p_status,p_assignee_id,auth.uid())
    on conflict(id) do update set title=excluded.title,service=excluded.service,due_date=excluded.due_date,status=excluded.status,assignee_id=excluded.assignee_id,
      source=case when public.tasks.due_date is distinct from excluded.due_date then 'manual' else public.tasks.source end,
      updated_at=now() where public.tasks.child_id=excluded.child_id;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select family_id into fid from public.children where id=p_child_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'task_saved',p_id);
  return p_id;
end $$;

alter table public.profiles add constraint valid_timezone check(timezone in ('Asia/Seoul','UTC','America/New_York','Europe/London','Asia/Tokyo'));
alter table public.content_items add constraint publication_review_required check(status<>'published' or (last_reviewed_at is not null and reviewer is not null and source_url is not null));

-- Remove stale assignments together with the membership/access grant.
create or replace function public.revoke_member(p_family_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) or p_user_id=auth.uid() then raise exception 'forbidden' using errcode='42501'; end if;
  delete from public.family_members where family_id=p_family_id and user_id=p_user_id and role<>'owner';
  if found then
    update public.tasks t set assignee_id=null,updated_at=now()
      from public.children c where c.id=t.child_id and c.family_id=p_family_id and t.assignee_id=p_user_id;
    insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family_id,auth.uid(),'member_revoked',p_user_id);
  end if;
end $$;
