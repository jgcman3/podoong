begin;
create function public.update_child_details(p_child_id uuid,p_name text,p_sex text,p_birth_date date)
returns void language plpgsql security definer set search_path='' as $$
declare fid uuid;
begin
  if not public.account_active() or not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 60 or p_sex is null or p_sex not in ('female','male') or p_birth_date is null or p_birth_date>(now() at time zone 'Asia/Seoul')::date then
    raise exception 'invalid_child_details' using errcode='22023';
  end if;
  update public.children set name=trim(p_name),sex=p_sex,birth_date=p_birth_date where id=p_child_id returning family_id into fid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'child_details_updated',p_child_id);
end $$;
revoke all on function public.update_child_details(uuid,text,text,date) from public,anon;
grant execute on function public.update_child_details(uuid,text,text,date) to authenticated;
commit;
