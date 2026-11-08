-- Family participants can record and edit; family administration stays owner-only.
update public.family_members set role='editor' where role='viewer';
update public.child_access set role='editor' where role='viewer';
update public.invitations set role='editor' where role='viewer';

create or replace function public.create_invitation(p_child_id uuid,p_role text) returns text
language plpgsql security definer set search_path='' as $$
declare fid uuid; token text;
begin
  select family_id into fid from public.children where id=p_child_id;
  if not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
  token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.invitations(family_id,child_id,role,token_hash,created_by)
    values(fid,p_child_id,'editor',encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'invitation_created',p_child_id);
  return token;
end $$;
