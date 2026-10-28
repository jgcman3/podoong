-- Save the diary and its chosen audience in the same transaction.
-- Existing private diaries are deliberately not republished.
create or replace function public.save_growth_diary(
 p_id uuid, p_child uuid, p_data jsonb, p_private boolean default false,
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
revoke all on function public.save_growth_diary(uuid,uuid,jsonb,boolean,integer) from public,anon;
grant execute on function public.save_growth_diary(uuid,uuid,jsonb,boolean,integer) to authenticated;
