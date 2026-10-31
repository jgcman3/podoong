begin;
-- Snapshot the coarse residence on each post; never expose family IDs or addresses.
create function public.community_home_area(p_family uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('country',f.residence_country_code,
 'city',case when f.residence_country_code='KR' then
   split_part(f.residence_city,' ',1)||case when split_part(f.residence_city,' ',2) ~ '(시|군)$' then ' '||split_part(f.residence_city,' ',2) else '' end
   else coalesce(f.residence_province,'')||' '||coalesce(f.residence_city,'') end,
 'district',f.residence_city,'locality',f.residence_locality)
 from public.families f where f.id=p_family;
$$;
revoke all on function public.community_home_area(uuid) from public,anon,authenticated;
alter table public.neighborhood_posts
 add column category text not null default 'childcare' check(category in ('childcare','outings','gear','development','feeding','birth-supplies','postpartum','health','toddler-food','birth','solids')),
 add column country text, add column area_city text,add column area_district text,add column area_locality text;
update public.neighborhood_posts p set country=a.v->>'country',area_city=a.v->>'city',area_district=a.v->>'district',area_locality=a.v->>'locality'
from (select f.id,public.community_home_area(f.id) v from public.families f) a where a.id=p.family_id;
create function public.snapshot_community_area() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb; begin
 if new.country is not null and new.area_district is not null then return new; end if;
 a:=public.community_home_area(new.family_id);
 new.country:=a->>'country';new.area_city:=a->>'city';new.area_district:=a->>'district';new.area_locality:=a->>'locality';return new;
end $$;
revoke all on function public.snapshot_community_area() from public,anon,authenticated;
create trigger snapshot_community_area before insert on public.neighborhood_posts for each row execute function public.snapshot_community_area();
create index neighborhood_all_feed on public.neighborhood_posts(feature,created_at desc,id desc);
create index neighborhood_category_feed on public.neighborhood_posts(feature,category,created_at desc,id desc);
create index neighborhood_city_feed on public.neighborhood_posts(country,area_city,feature,created_at desc,id desc);
create index neighborhood_district_feed on public.neighborhood_posts(country,area_city,area_district,feature,created_at desc,id desc);
create index neighborhood_locality_feed on public.neighborhood_posts(country,area_city,area_district,area_locality,feature,created_at desc,id desc);
-- Region identifiers are validated against public catalogues, never another family's address.
create function public.community_selected_area(p_family uuid,p_place text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb; r public.residence_regions; g public.global_residence_places; begin
 a:=public.community_home_area(p_family);
 if nullif(p_place,'') is null then return a; end if;
 if coalesce(a->>'country','KR')='KR' then
  select * into r from public.residence_regions where country_code='KR' and code=p_place and active and selectable;
  if not found then raise exception 'invalid region' using errcode='22023'; end if;
  return jsonb_build_object('country','KR','city',split_part(r.city_name,' ',1)||case when split_part(r.city_name,' ',2) ~ '(시|군)$' then ' '||split_part(r.city_name,' ',2) else '' end,'district',r.city_name,'locality',r.locality_name);
 end if;
 if p_place !~ '^[a-f0-9-]{36}$' then raise exception 'invalid region' using errcode='22023'; end if;
 select * into g from public.global_residence_places where id=p_place::uuid and country_code=a->>'country';
 if not found then raise exception 'invalid region' using errcode='22023'; end if;
 return jsonb_build_object('country',g.country_code,'city',g.province||' '||g.city,'district',g.city,'locality',g.locality);
end $$;
revoke all on function public.community_selected_area(uuid,text) from public,anon,authenticated;
create or replace function public.neighborhood_feed(p_family uuid,p_feature text) returns table(id uuid,title text,body text,created_at timestamptz,mine boolean) language plpgsql stable security definer set search_path='' as $$ declare r text; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_feature not in ('boards','market','support') or p_feature is null then raise exception 'invalid feature' using errcode='22023'; end if;
 r:=public.neighborhood_region(p_family);
 return query select p.id,p.title,p.body,p.created_at,p.author_id=auth.uid() from public.neighborhood_posts p where p.region=r and p.feature=p_feature order by p.created_at desc,p.id limit 50;
end $$;
create function public.parenting_feed(p_family uuid,p_scope text default 'all',p_category text default 'all',p_before timestamptz default null,p_place text default '',p_feature text default 'boards',p_before_id uuid default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_scope not in ('all','city','district','locality') or p_scope is null or p_feature not in ('boards','market') then raise exception 'invalid scope' using errcode='22023'; end if;
 a:=public.community_selected_area(p_family,p_place);
 return query select p.id,p.title,p.body,p.category,p.area_district||' '||coalesce(p.area_locality,''),p.created_at,p.author_id=auth.uid()
 from public.neighborhood_posts p where p.feature=p_feature
 and (p_scope='all' or (p.country=a->>'country' and p.area_city=a->>'city'
 and (case p_scope when 'city' then true when 'district' then p.area_district=a->>'district' else p.area_district=a->>'district' and p.area_locality=a->>'locality' end)))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 50;
end $$;
create function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text,p_place text default '',p_feature text default 'boards') returns uuid
language plpgsql security definer set search_path='' as $$ declare pid uuid; a jsonb; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_feature not in ('boards','market') then raise exception 'invalid feature' using errcode='22023'; end if;
 a:=public.community_selected_area(p_family,p_place);
 if nullif(a->>'district','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_posts(region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality)
 values(a->>'country'||':'||lower(a->>'district'),p_feature,p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality') returning id into pid;
 return pid;
end $$;
revoke all on function public.parenting_feed(uuid,text,text,timestamptz,text,text,uuid),public.save_parenting_post(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.parenting_feed(uuid,text,text,timestamptz,text,text,uuid),public.save_parenting_post(uuid,text,text,text,text,text) to authenticated;
-- The admin view counts resident families, not activation applicants.
drop function public.admin_neighborhoods();
create function public.admin_neighborhoods() returns table(region text,families bigint) language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select f.residence_country_code||':'||coalesce(f.residence_province||' ','')||f.residence_city,count(*) from public.families f
 where f.merged_into is null and nullif(f.residence_city,'') is not null
 group by f.residence_country_code,f.residence_province,f.residence_city order by count(*) desc limit 100;
end $$;
revoke all on function public.admin_neighborhoods() from public,anon;
grant execute on function public.admin_neighborhoods() to authenticated;
-- The application no longer exposes neighborhood requests or activation gates.
drop function public.request_neighborhood(uuid,text);
drop function public.request_neighborhood_family(uuid);
drop function public.neighborhood_status(uuid);
drop table public.neighborhood_requests,public.neighborhood_enrollments,public.neighborhood_openings;

-- Only the trusted scheduled collector may write official support information.
create table public.parenting_support (
 id text primary key,title text not null,summary text not null default '',eligibility text not null default '',benefit text not null default '',
 application_period text not null default '',agency text not null,agency_type text not null default '',url text not null check(url ~ '^https://'),
 region_terms text[] not null default '{}',national boolean not null default false,
 source_updated text not null default '',collected_at timestamptz not null,run_id uuid not null,active boolean not null default true
);
create index parenting_support_regions on public.parenting_support using gin(region_terms) where active;
create table public.parenting_support_sync (
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),finished_at timestamptz,status text not null check(status in ('running','success','failed')),
 item_count integer not null default 0
);
alter table public.parenting_support enable row level security;
alter table public.parenting_support_sync enable row level security;
revoke all on public.parenting_support,public.parenting_support_sync from public,anon,authenticated;
grant select on public.parenting_support,public.parenting_support_sync to authenticated;
create policy support_read on public.parenting_support for select to authenticated using(public.account_active() and active);
create policy support_sync_read on public.parenting_support_sync for select to authenticated using(public.account_active() and status='success');
create unique index support_one_sync on public.parenting_support_sync(status) where status='running';
create function public.begin_parenting_support_sync() returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; begin
 perform pg_advisory_xact_lock(310067);
 update public.parenting_support_sync set status='failed',finished_at=now() where status='running' and started_at<now()-interval '15 minutes';
 if exists(select 1 from public.parenting_support_sync where status='running') then return null; end if;
 insert into public.parenting_support_sync(status) values('running') returning id into rid;
 delete from public.parenting_support_sync where started_at<now()-interval '90 days' and status<>'running';
 return rid;
end $$;
create function public.publish_parenting_support(p_run uuid,p_rows jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.parenting_support_sync where id=p_run and status='running' and started_at>now()-interval '15 minutes' for update;
 if not found or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'invalid sync'; end if;
 insert into public.parenting_support
 select r.id,r.title,r.summary,r.eligibility,r.benefit,r.application_period,r.agency,r.agency_type,r.url,r.region_terms,r.national,r.source_updated,r.collected_at,p_run,true
 from jsonb_populate_recordset(null::public.parenting_support,p_rows) r
 on conflict(id) do update set title=excluded.title,summary=excluded.summary,eligibility=excluded.eligibility,benefit=excluded.benefit,application_period=excluded.application_period,agency=excluded.agency,agency_type=excluded.agency_type,url=excluded.url,region_terms=excluded.region_terms,national=excluded.national,source_updated=excluded.source_updated,collected_at=excluded.collected_at,run_id=excluded.run_id,active=true;
 update public.parenting_support set active=false where run_id<>p_run and active;
 update public.parenting_support_sync set status='success',finished_at=now(),item_count=jsonb_array_length(p_rows) where id=p_run;
end $$;
create table public.parenting_support_config(singleton boolean primary key default true check(singleton),worker_url text not null,token_secret_id uuid not null);
alter table public.parenting_support_config enable row level security;
revoke all on public.parenting_support_config from public,anon,authenticated;
create function public.dispatch_parenting_support() returns void language plpgsql security definer set search_path='' as $$
declare config public.parenting_support_config; token text; begin
 select * into config from public.parenting_support_config; if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podoong-support-token',token),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
create function public.configure_parenting_support(p_worker_url text,p_token text) returns void language plpgsql security definer set search_path='' as $$
declare secret_id uuid; begin
 if p_worker_url !~ '^https://[a-z0-9]{20}[.]supabase[.]co/functions/v1/parenting-support$' or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invalid config'; end if;
 select token_secret_id into secret_id from public.parenting_support_config;
 if secret_id is null then select vault.create_secret(p_token,'podoong_support_worker') into secret_id;
 else perform vault.update_secret(secret_id,p_token); end if;
 insert into public.parenting_support_config(singleton,worker_url,token_secret_id) values(true,p_worker_url,secret_id) on conflict(singleton) do update set worker_url=excluded.worker_url;
 -- 03:20 KST daily; inactive until a trusted operator configures the source key and worker.
 perform cron.schedule('podoong-parenting-support','20 18 * * *','select public.dispatch_parenting_support()');
end $$;
revoke all on function public.begin_parenting_support_sync(),public.publish_parenting_support(uuid,jsonb),public.configure_parenting_support(text,text),public.dispatch_parenting_support() from public,anon,authenticated;
grant execute on function public.begin_parenting_support_sync(),public.publish_parenting_support(uuid,jsonb),public.configure_parenting_support(text,text) to service_role;
commit;
