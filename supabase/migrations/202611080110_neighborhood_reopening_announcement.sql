begin;
alter table public.neighborhood_board_openings add column is_open boolean not null default false,
 add column opening_count integer not null default 0;

-- Remember a closure immediately, including when nobody visits between departure and arrival.
create function public.neighborhood_board_departure() returns trigger
language plpgsql security definer set search_path='' as $$
declare family uuid;
begin
 if tg_table_name='families' then
  family:=old.id;
  if tg_op='UPDATE' and (old.residence_country_code,old.residence_province,old.residence_city,old.residence_locality,old.merged_into)
    is not distinct from (new.residence_country_code,new.residence_province,new.residence_city,new.residence_locality,new.merged_into) then return new; end if;
 elsif tg_table_name='children' then
  family:=old.family_id;
  if (select count(*) from public.children where family_id=family)>1 then return old; end if;
 else
  family:=old.family_id;
  if (select count(*) from public.family_members where family_id=family)>1 then return old; end if;
 end if;
 if public.neighborhood_family_count(family)<=3 then
  update public.neighborhood_board_openings set is_open=false
  where region_key=md5(public.community_home_area(family)::text)::uuid and is_open;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.neighborhood_board_departure() from public,anon,authenticated;
create trigger neighborhood_family_departure before update of residence_country_code,residence_province,residence_city,residence_locality,merged_into or delete on public.families
for each row execute function public.neighborhood_board_departure();
create trigger neighborhood_child_departure before delete on public.children
for each row execute function public.neighborhood_board_departure();
create trigger neighborhood_member_departure before delete on public.family_members
for each row execute function public.neighborhood_board_departure();

create or replace function public.neighborhood_board_status(p_family uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare families integer; region uuid; created uuid; founders jsonb; opening_count integer;
begin
 if not public.account_active() or not public.is_family_member(p_family) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 region:=md5(public.community_home_area(p_family)::text)::uuid;
 families:=public.neighborhood_family_count(p_family);
 if families>=3 then
  insert into public.neighborhood_board_openings(region_key,is_open,opening_count) values(region,true,1)
  on conflict(region_key) do update set is_open=true,opening_count=public.neighborhood_board_openings.opening_count+1,opened_at=now()
  where not public.neighborhood_board_openings.is_open returning region_key into created;
  if created is not null then
   delete from public.neighborhood_board_founders where region_key=region;
   insert into public.neighborhood_board_founders(region_key,family_id,name,position)
   select region, f.id, f.name, f.position from (
  select f.id, f.name, row_number() over(order by f.created_at,f.id)::integer as position from public.families f join public.families home on home.id=p_family and home.merged_into is null
  where f.merged_into is null
   and nullif(f.residence_country_code,'') is not null
   and nullif(f.residence_city,'') is not null
   and nullif(f.residence_locality,'') is not null
   and f.residence_country_code=home.residence_country_code
   and f.residence_city=home.residence_city and f.residence_locality=home.residence_locality
   and (f.residence_country_code='KR' or coalesce(f.residence_province,'')=coalesce(home.residence_province,''))
   and exists(select 1 from public.children c where c.family_id=f.id)
   and exists(select 1 from public.family_members m where m.family_id=f.id)
 order by f.created_at,f.id limit 3
   ) f;
  end if;
 else
  update public.neighborhood_board_openings set is_open=false where region_key=region and is_open;
 end if;
 select opening.opening_count into opening_count from public.neighborhood_board_openings opening where opening.region_key=region;
 select coalesce(jsonb_agg(name order by position),'[]'::jsonb) into founders
 from public.neighborhood_board_founders where region_key=region;
 return jsonb_build_object('families',families,'open',public.neighborhood_board_is_open(p_family),'founders',founders,'reopened',coalesce(opening_count,0)>1);
end $$;

commit;
