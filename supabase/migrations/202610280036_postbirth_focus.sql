begin;
-- Retain historical family-written tasks as ordinary to-dos, without lifecycle automation.
update public.tasks set service='general',source='manual',template_key=null,anchor=null,offset_days=null
where service in ('pregnancy','birth','administration','postpartum','school');
update public.content_items set status='draft' where service in ('pregnancy','birth','administration','postpartum','school');
drop function public.add_preparation_tasks(uuid,text);
drop function public.update_child_dates(uuid,date,date);
drop function public.preview_child_dates(uuid,date,date);
drop function public.create_family_with_child(text,text,date,date,text);
create function public.create_family_with_child(p_family_name text,p_child_name text,p_birth_date date,p_sex text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid; cid uuid;
begin
  if p_birth_date is null or p_birth_date > (now() at time zone 'Asia/Seoul')::date then raise exception 'birth_date_required' using errcode='22023'; end if;
  if p_sex is null or p_sex not in ('female','male') then raise exception 'sex_required' using errcode='22023'; end if;
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and consented_at is not null for update;
  if not found then raise exception 'consent_required'; end if;
  select c.id into cid from public.children c join public.family_members m on m.family_id=c.family_id
    where m.user_id=auth.uid() and m.role='owner' order by c.created_at limit 1;
  if cid is not null then return cid; end if;
  insert into public.families(name) values(p_family_name) returning id into fid;
  insert into public.family_members values(fid,auth.uid(),'owner');
  insert into public.children(family_id,name,birth_date,sex) values(fid,p_child_name,p_birth_date,p_sex) returning id into cid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'family_created',cid);
  return cid;
end $$;

revoke all on function public.create_family_with_child(text,text,date,text) from public,anon;
grant execute on function public.create_family_with_child(text,text,date,text) to authenticated;
-- General family to-dos use the same child permissions and assignee checks.
create or replace function public.save_task(p_id uuid,p_child_id uuid,p_title text,p_service text,p_due_date date,p_status text,p_assignee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from unnest(array['general','feeding','sleep','diaper','food','growth','health','vaccination','support','nursery','kindergarten','community','polls']) s where s=p_service) then raise exception 'invalid_service'; end if;
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

create function public.update_child_birth_date(p_child_id uuid,p_birth_date date)
returns void language plpgsql security definer set search_path='' as $$
declare fid uuid;
begin
  if not public.account_active() or not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_birth_date is null or p_birth_date > (now() at time zone 'Asia/Seoul')::date then raise exception 'birth_date_required' using errcode='22023'; end if;
  update public.children set birth_date=p_birth_date where id=p_child_id returning family_id into fid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'child_birth_date_updated',p_child_id);
end $$;
revoke all on function public.update_child_birth_date(uuid,date) from public,anon;
grant execute on function public.update_child_birth_date(uuid,date) to authenticated;
-- Existing undated children remain editable; no invented birth dates.
create function public.require_child_birth_date() returns trigger language plpgsql set search_path='' as $$
begin
  if new.birth_date is null or new.birth_date > (now() at time zone 'Asia/Seoul')::date then raise exception 'birth_date_required' using errcode='22023'; end if;
  return new;
end $$;
create trigger child_birth_date_required before insert or update of birth_date on public.children
for each row execute function public.require_child_birth_date();
commit;
