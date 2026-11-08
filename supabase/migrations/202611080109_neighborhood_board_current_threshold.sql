begin;
-- Keep the opening announcement, but allow access only while 3 families live here.
create or replace function public.neighborhood_board_is_open(p_family uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.neighborhood_family_count(p_family)>=3;
$$;
revoke all on function public.neighborhood_board_is_open(uuid) from public,anon,authenticated;
commit;
