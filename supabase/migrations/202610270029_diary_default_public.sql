-- Save the diary and its chosen audience in the same transaction.
-- Existing private diaries are deliberately not republished.
create function public.save_growth_diary(
 p_id uuid, p_child uuid, p_data jsonb, p_private boolean default false,
 p_version integer default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; child_sex text;
begin
 if p_private is null then raise exception 'invalid privacy' using errcode='22023'; end if;
 saved := public.save_child_record(p_id,p_child,'growth',p_data,p_version);
 select sex into child_sex from public.children where id=p_child;
 perform public.share_growth_diary(saved,not p_private,not p_private,coalesce(child_sex,''));
 return saved;
end $$;
revoke all on function public.save_growth_diary(uuid,uuid,jsonb,boolean,integer) from public,anon;
grant execute on function public.save_growth_diary(uuid,uuid,jsonb,boolean,integer) to authenticated;
