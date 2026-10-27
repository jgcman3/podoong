-- One network round trip for a child's family and permission context.
-- Invoker rights retain table RLS; this does not cache authorization.
create function public.family_access_context(p_child uuid)
returns table(family jsonb,members jsonb,caregivers jsonb,owner boolean,writable boolean)
language plpgsql stable security invoker set search_path='' as $$
declare fid uuid;
begin
 if not public.account_active() or not public.can_read_child(p_child) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select family_id into fid from public.children where id=p_child;
 return query select
  (select to_jsonb(f) from public.families f where f.id=fid),
  coalesce((select jsonb_agg(to_jsonb(m)) from public.family_members m where m.family_id=fid),'[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(c)) from public.list_caregivers(p_child) c),'[]'::jsonb),
  public.is_family_owner(fid),public.can_write_child(p_child);
end $$;
revoke all on function public.family_access_context(uuid) from public,anon;
grant execute on function public.family_access_context(uuid) to authenticated;
