-- General family to-dos use the same child permissions and assignee checks.
create or replace function public.save_task(p_id uuid,p_child_id uuid,p_title text,p_service text,p_due_date date,p_status text,p_assignee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from unnest(array['general','pregnancy','birth','administration','postpartum','feeding','sleep','diaper','food','growth','health','vaccination','support','nursery','kindergarten','school','community','polls']) s where s=p_service) then raise exception 'invalid_service'; end if;
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
