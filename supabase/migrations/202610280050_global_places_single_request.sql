begin;
create function public.place_name_key(p_name text) returns text language sql immutable set search_path='' as $$ select lower(regexp_replace(trim(p_name),'\s+',' ','g')); $$;
create table public.global_residence_places(id uuid primary key default gen_random_uuid(),country_code text not null references public.residence_countries(code),province text not null check(length(trim(province)) between 1 and 80),city text not null check(length(trim(city)) between 1 and 80),locality text not null check(length(trim(locality)) between 1 and 80),province_key text generated always as(public.place_name_key(province)) stored,city_key text generated always as(public.place_name_key(city)) stored,locality_key text generated always as(public.place_name_key(locality)) stored,unique(country_code,province_key,city_key,locality_key));
alter table public.global_residence_places enable row level security;
revoke all on public.global_residence_places from public,anon,authenticated;
grant select on public.global_residence_places to authenticated;
create policy global_places_read on public.global_residence_places for select to authenticated using(true);
alter table public.families add column residence_province text,add column global_place_id uuid references public.global_residence_places(id);
create function public.save_global_residence(p_family uuid,p_country text,p_province text,p_city text,p_locality text,p_version integer) returns void language plpgsql security definer set search_path='' as $$ declare pid uuid; place public.global_residence_places; begin
 if not public.account_active() or not public.is_family_owner(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.families where id=p_family and residence_version=p_version for update;
 if not found then raise exception 'conflict'; end if;
 if p_country='KR' or not exists(select 1 from public.residence_countries where code=p_country and enabled) then raise exception 'invalid country' using errcode='22023'; end if;
 if nullif(trim(p_province),'') is null or nullif(trim(p_city),'') is null or nullif(trim(p_locality),'') is null then raise exception 'region required' using errcode='22023'; end if;
 insert into public.global_residence_places(country_code,province,city,locality) values(p_country,regexp_replace(trim(p_province),'\s+',' ','g'),regexp_replace(trim(p_city),'\s+',' ','g'),regexp_replace(trim(p_locality),'\s+',' ','g')) on conflict(country_code,province_key,city_key,locality_key) do update set country_code=excluded.country_code returning * into place;
 update public.families set residence_country_code=p_country,residence_province=place.province,residence_city=place.city,residence_locality=place.locality,global_place_id=place.id,residence_region_code=null,residence_version=residence_version+1,residence_updated_at=now() where id=p_family;
end $$;
-- Reset overseas metadata when the existing Korean/country-only forms change address.
create function public.clear_global_residence_metadata() returns trigger language plpgsql set search_path='' as $$ begin
 if new.residence_country_code='KR' or new.residence_city is null then new.residence_province:=null; new.global_place_id:=null; end if;
 return new;
end $$;
create trigger clear_global_residence_metadata before update on public.families for each row execute function public.clear_global_residence_metadata();
create or replace function public.neighborhood_region(p_family uuid) returns text language sql stable security definer set search_path='' as $$
 select case when residence_country_code='KR' then residence_country_code||':'||lower(trim(residence_city))
 when nullif(trim(residence_province),'') is not null then residence_country_code||':'||jsonb_build_array(public.place_name_key(residence_province),public.place_name_key(residence_city))::text end from public.families where id=p_family and residence_country_code is not null and nullif(trim(residence_city),'') is not null;
$$;
create table public.neighborhood_enrollments(family_id uuid primary key references public.families on delete cascade,region text not null,created_at timestamptz not null default now());
alter table public.neighborhood_enrollments enable row level security;
revoke all on public.neighborhood_enrollments from public,anon,authenticated;
insert into public.neighborhood_enrollments(family_id,region,created_at) select distinct on(family_id) family_id,region,created_at from public.neighborhood_requests order by family_id,created_at desc;
-- Preserve an already opened neighborhood, and open its three features together.
insert into public.neighborhood_openings(region,feature,opened_at) select distinct o.region,f.key,min(o.opened_at) from public.neighborhood_openings o cross join (values('boards'),('market'),('support')) f(key) where o.opened_at is not null group by o.region,f.key on conflict(region,feature) do update set opened_at=excluded.opened_at;
create or replace function public.neighborhood_status(p_family uuid) returns table(feature text,families bigint,requested boolean,opened boolean) language plpgsql security definer set search_path='' as $$ declare r text; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 r:=public.neighborhood_region(p_family);
 return query select f.key,(select count(*) from public.neighborhood_enrollments v where v.region=r and public.neighborhood_region(v.family_id)=r),exists(select 1 from public.neighborhood_enrollments v where v.family_id=p_family and v.region=r),exists(select 1 from public.neighborhood_openings o where o.region=r and o.feature=f.key and o.opened_at is not null) from (values('boards'),('market'),('support')) f(key);
end $$;
create function public.request_neighborhood_family(p_family uuid) returns void language plpgsql security definer set search_path='' as $$ declare r text; n bigint; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 r:=public.neighborhood_region(p_family); if r is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_openings(region,feature) select r,f.key from (values('boards'),('market'),('support')) f(key) on conflict do nothing;
 perform 1 from public.neighborhood_openings where region=r and feature='boards' for update;
 insert into public.neighborhood_enrollments(family_id,region) values(p_family,r) on conflict(family_id) do update set region=excluded.region;
 select count(*) into n from public.neighborhood_enrollments v where v.region=r and public.neighborhood_region(v.family_id)=r;
 if n>=10 then update public.neighborhood_openings set opened_at=coalesce(opened_at,now()) where region=r; end if;
end $$;
create or replace function public.request_neighborhood(p_family uuid,p_feature text) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_feature is null or p_feature not in ('boards','market','support') then raise exception 'invalid feature' using errcode='22023'; end if;
 perform public.request_neighborhood_family(p_family);
end $$;
revoke all on function public.save_global_residence(uuid,text,text,text,text,integer),public.request_neighborhood_family(uuid),public.clear_global_residence_metadata() from public,anon;
grant execute on function public.save_global_residence(uuid,text,text,text,text,integer),public.request_neighborhood_family(uuid) to authenticated;

create function public.global_place_options(p_country text,p_province text,p_city text) returns table(province text,city text,locality text) language sql stable security invoker set search_path='' as $$
 select distinct p.province,''::text,''::text from public.global_residence_places p where p.country_code=p_country
 union select distinct p.province,p.city,''::text from public.global_residence_places p where p.country_code=p_country and p.province_key=public.place_name_key(p_province)
 union select p.province,p.city,p.locality from public.global_residence_places p where p.country_code=p_country and p.province_key=public.place_name_key(p_province) and p.city_key=public.place_name_key(p_city);
$$;
revoke all on function public.global_place_options(text,text,text) from public,anon;
grant execute on function public.global_place_options(text,text,text) to authenticated;
insert into public.neighborhood_openings(region,feature,opened_at) select e.region,f.key,now() from public.neighborhood_enrollments e cross join (values('boards'),('market'),('support')) f(key) where public.neighborhood_region(e.family_id)=e.region group by e.region,f.key having count(*)>=10 on conflict(region,feature) do update set opened_at=coalesce(public.neighborhood_openings.opened_at,excluded.opened_at);
commit;
