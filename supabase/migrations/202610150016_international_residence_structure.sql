-- Keep the product Korea-only while allowing new country catalogues without DDL changes.
create table public.residence_countries (
 code text primary key check(code ~ '^[A-Z]{2}$'),
 name text not null check(length(btrim(name)) between 1 and 100),
 enabled boolean not null default false
);
alter table public.residence_countries enable row level security;
create policy residence_countries_read on public.residence_countries for select to anon,authenticated using (true);
revoke all on public.residence_countries from public,anon,authenticated;
grant select on public.residence_countries to anon,authenticated;
insert into public.residence_countries(code,name,enabled) values ('KR','대한민국',true);

alter table public.residence_regions
 drop constraint residence_regions_country_code_check,
 drop constraint residence_regions_code_check,
 alter column country_code drop default,
 add constraint residence_regions_country_fk foreign key(country_code) references public.residence_countries(code),
 add constraint residence_regions_code_format check(length(code) between 1 and 128 and code=btrim(code) and code !~ '[[:cntrl:]]'),
 add column level smallint not null default 1 check(level>=1),
 add column kind text not null default 'locality' check(length(btrim(kind)) between 1 and 60),
 add column selectable boolean not null default true,
 add column parent_code text,
 add column parent_level smallint,
 add constraint residence_regions_level_key unique(country_code,code,level),
 add constraint residence_regions_parent_level check(
  (parent_code is null and parent_level is null and level=1) or
  (parent_code is not null and parent_level is not null and parent_level=level-1)
 ),
 add constraint residence_regions_parent_fk foreign key(country_code,parent_code,parent_level)
  references public.residence_regions(country_code,code,level) deferrable initially immediate;
create index residence_regions_parent_idx on public.residence_regions(country_code,parent_code);
comment on column public.residence_regions.code is 'Opaque country-scoped canonical identifier. KR locality codes use 10-digit legal codes; other countries may use alphanumeric codes.';
comment on column public.residence_regions.kind is 'Country-specific region kind, e.g. province, district, state, county, city, locality, neighborhood.';
comment on column public.residence_regions.level is 'Hierarchy depth within a country; not a fixed worldwide administrative level. Parent must be at the preceding depth.';
comment on column public.residence_regions.selectable is 'Whether this node can be a family residence; parent grouping nodes need not be selectable.';

-- The source snapshot has a trailing space in 대신면's label. Normalize its
-- empty locality before deriving groups; never rewrite the applied 015 snapshot.
update public.residence_regions
 set locality_name=substring(btrim(city_name) from '[^ ]+$'),
 city_name=regexp_replace(btrim(city_name),' [^ ]+$','')
 where country_code='KR' and btrim(locality_name)='';

-- Derived KR dropdown groups. These namespace-prefixed keys are grouping IDs,
-- not official legal locality codes. Existing family/locality codes stay unchanged.
insert into public.residence_regions(country_code,code,city_name,locality_name,level,kind,selectable)
 select distinct 'KR','province:'||substr(code,1,2),split_part(city_name,' ',1),split_part(city_name,' ',1),1,'province',false
 from public.residence_regions where country_code='KR' and kind='locality';
insert into public.residence_regions(country_code,code,city_name,locality_name,level,kind,selectable,parent_code,parent_level)
 select distinct 'KR','district:'||substr(code,1,5),city_name,regexp_replace(city_name,'^[^ ]+ ',''),2,'district',false,'province:'||substr(code,1,2),1
 from public.residence_regions where country_code='KR' and kind='locality';
update public.residence_regions set level=3,parent_code='district:'||substr(code,1,5),parent_level=2
 where country_code='KR' and kind='locality';
comment on column public.families.residence_region_code is 'Canonical region key scoped by residence_country_code; references the selected node in residence_regions, independent of country hierarchy depth.';
create index families_residence_region_idx on public.families(residence_country_code,residence_region_code)
 where residence_region_code is not null;

-- Replace the repository-owned signature; default KR preserves existing 3-argument calls.
drop function public.save_family_residence_region(uuid,text,integer);
create function public.save_family_residence_region(p_family uuid,p_region_code text,p_version integer,p_country_code text default 'KR') returns void
language plpgsql security definer set search_path='' as $$
declare current_version integer; region public.residence_regions; selected_code text:=nullif(p_region_code,'');
begin
 if auth.uid() is null or not public.account_active() or not public.is_family_owner(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 select residence_version into current_version from public.families where id=p_family for update;
 if p_version is null or current_version is null or current_version<>p_version then raise exception 'conflict'; end if;
 if p_region_code is null then raise exception 'invalid region' using errcode='22023'; end if;
 if selected_code is not null then
  select r.* into region from public.residence_regions r
   join public.residence_countries c on c.code=r.country_code and c.enabled
   where r.country_code=p_country_code and r.code=selected_code and r.active and r.selectable
    and not exists (
     with recursive ancestors as (
      select p.country_code,p.code,p.parent_code,p.active from public.residence_regions p
       where p.country_code=r.country_code and p.code=r.parent_code
      union all
      select p.country_code,p.code,p.parent_code,p.active from public.residence_regions p
       join ancestors a on p.country_code=a.country_code and p.code=a.parent_code
     ) select 1 from ancestors where not active
    );
  if not found then raise exception 'invalid region' using errcode='22023'; end if;
 end if;
 update public.families set residence_country_code=region.country_code,
  residence_region_code=selected_code,residence_city=region.city_name,residence_locality=region.locality_name,
  residence_version=residence_version+1,residence_updated_at=now() where id=p_family;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family,auth.uid(),'family_residence_saved',p_family);
end $$;
revoke all on function public.save_family_residence_region(uuid,text,integer,text) from public,anon;
grant execute on function public.save_family_residence_region(uuid,text,integer,text) to authenticated;
