begin;

-- One request and one statement snapshot; every table read retains the caller's RLS.
create function public.app_family_snapshot(p_child uuid default null)
returns table(
 profile jsonb,children jsonb,child jsonb,
 family jsonb,members jsonb,caregivers jsonb,owner boolean,writable boolean,
 privacy jsonb
)
language plpgsql stable security invoker set search_path='' as $$
declare
 profile_data jsonb;
 children_data jsonb;
 child_data jsonb;
 access_data record;
begin
 if auth.uid() is null or not public.account_active() then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select to_jsonb(p) into profile_data from public.profiles p where p.id=auth.uid();
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]'::jsonb)
 into children_data from public.children c;

 if profile_data->>'consented_at' is null or jsonb_array_length(children_data)=0 then
  return query select profile_data,children_data,null::jsonb,
   null::jsonb,null::jsonb,null::jsonb,false,false,null::jsonb;
  return;
 end if;

 select item.value into child_data from jsonb_array_elements(children_data) item
 where item.value->>'id'=p_child::text;
 child_data:=coalesce(child_data,children_data->0);
 select * into access_data from public.family_access_context((child_data->>'id')::uuid);
 return query select profile_data,children_data,child_data,
  access_data.family,access_data.members,access_data.caregivers,
  access_data.owner,access_data.writable,
  public.privacy_state((child_data->>'id')::uuid);
end $$;

revoke all on function public.app_family_snapshot(uuid) from public,anon;
grant execute on function public.app_family_snapshot(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
