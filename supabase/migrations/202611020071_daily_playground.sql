begin;
alter table public.parenting_friend_profiles drop constraint parenting_friend_profiles_nickname_check;
alter table public.parenting_friend_profiles add constraint parenting_friend_profiles_nickname_check check(length(trim(nickname)) between 1 and 121);
-- Only virtual coordinates are stored. A child joins once per home-local day,
-- when the playground is visited; no midnight sweep or pre-built room is needed.
create table public.parenting_playground_regions (
 id uuid primary key,country text not null,province text not null,city text not null,locality text not null,timezone text not null
);
create table public.parenting_playground_positions (
 region_id uuid references public.parenting_playground_regions on delete cascade,
 day date,child_id uuid references public.children on delete cascade,slot integer not null,
 x integer not null,y integer not null,created_at timestamptz not null default now(),
 primary key(region_id,day,child_id),unique(region_id,day,slot)
);
create index playground_visible_range on public.parenting_playground_positions(region_id,day,x);
create index playground_old_positions on public.parenting_playground_positions(created_at);
alter table public.parenting_playground_regions enable row level security;
alter table public.parenting_playground_positions enable row level security;
revoke all on public.parenting_playground_regions,public.parenting_playground_positions from public,anon,authenticated;
grant all on public.parenting_playground_regions,public.parenting_playground_positions to service_role;
create function public.playground_region(p_family uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.families; rid uuid; province text; zone text; begin
 select * into f from public.families where id=p_family and merged_into is null;
 if not found or nullif(f.residence_country_code,'') is null or nullif(f.residence_city,'') is null or nullif(f.residence_locality,'') is null then return null; end if;
 province:=case when f.residence_country_code='KR' then '' else coalesce(f.residence_province,'') end;
 rid:=md5(jsonb_build_array(f.residence_country_code,province,f.residence_city,f.residence_locality)::text)::uuid;
 select p.timezone into zone from public.family_members m join public.profiles p on p.id=m.user_id where m.family_id=f.id and m.role='owner' order by m.user_id limit 1;
 zone:=case when f.residence_country_code='KR' then 'Asia/Seoul' when exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone else 'UTC' end;
 insert into public.parenting_playground_regions values(rid,f.residence_country_code,province,f.residence_city,f.residence_locality,zone) on conflict(id) do nothing;
 return rid;
end $$;
create function public.playground_auto_name() returns trigger language plpgsql security definer set search_path='' as $$ begin
 select concat_ws(' ',trim(f.name),trim(c.name)) into new.nickname from public.children c join public.families f on f.id=c.family_id where c.id=new.child_id;
 return new;
end $$;
create trigger playground_profile_name before insert or update on public.parenting_friend_profiles for each row execute function public.playground_auto_name();
create or replace function public.save_parenting_friend(p_child uuid,p_nickname text,p_status text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare fid uuid; display_name text; begin
 select c.family_id,concat_ws(' ',trim(f.name),trim(c.name)) into fid,display_name from public.children c join public.families f on f.id=c.family_id where c.id=p_child;
 if not public.account_active() or fid is null or not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_enabled is null or p_status is null or length(p_status)>80 or p_status ~ E'[\n\r]' then raise exception 'invalid profile' using errcode='22023'; end if;
 if p_enabled and nullif(public.community_home_area(fid)->>'locality','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 -- Ignore the old editable nickname argument: family name + child nickname only.
 insert into public.parenting_friend_profiles(child_id,nickname,status,enabled) values(p_child,display_name,trim(p_status),p_enabled)
 on conflict(child_id) do update set nickname=excluded.nickname,status=excluded.status,enabled=excluded.enabled;
end $$;
-- Keep names canonical; entering the playground determines attendance.
update public.parenting_friend_profiles p set nickname=concat_ws(' ',trim(f.name),trim(c.name)) from public.children c join public.families f on f.id=c.family_id where c.id=p.child_id;

create function public.parenting_playground(p_child uuid,p_left integer default null,p_right integer default null,p_day text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.children; f public.families; r public.parenting_playground_regions; own public.parenting_friend_profiles; pos public.parenting_playground_positions;
 today date; rid uuid; idx integer; col integer; lane integer; seed integer; lx integer; rx integer; lo integer; hi integer; n integer; members jsonb; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if (p_left is null)<>(p_right is null) or (p_left is not null and (abs(p_left::bigint)>100000000 or abs(p_right::bigint)>100000000 or p_right<p_left or p_right::bigint-p_left>4096)) then raise exception 'invalid viewport' using errcode='22023'; end if;
 select * into c from public.children where id=p_child; select * into f from public.families where id=c.family_id;
 rid:=public.playground_region(f.id); select * into own from public.parenting_friend_profiles where child_id=p_child;
 if rid is null then
  return jsonb_build_object('day',(now() at time zone 'UTC')::date,'timezone','UTC','expires_at',((date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC'),
   'width',680,'min_x',-340,'max_x',340,'height',520,'population',1,'left',-340,'right',340,
   'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,current_date-c.birth_date),'x',0,'y',355),'members','[]'::jsonb);
 end if;
 select * into r from public.parenting_playground_regions where id=rid; today:=(now() at time zone r.timezone)::date;
 select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
 if not found and c.birth_date<=today and c.birth_date>(today-interval '7 years')::date then
  -- Serialize first arrivals per neighborhood/day. Existing rows are never moved.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rid::text||today::text,0));
  select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
  if not found then
   select coalesce(max(slot)+1,0) into idx from public.parenting_playground_positions where region_id=rid and day=today;
   col:=idx/3; col:=case when col%2=1 then (col+1)/2*240 else -col/2*240 end; lane:=idx%3;
   seed:=('x'||substr(md5(rid::text||today::text||p_child::text),1,7))::bit(28)::integer;
   insert into public.parenting_playground_positions(region_id,day,child_id,slot,x,y)
    values(rid,today,p_child,idx,col+case lane when 1 then -55 when 2 then 55 else 0 end+seed%49-24,
    case lane when 1 then 275 when 2 then 435 else 355 end+(seed/53)%23-11) returning * into pos;
   -- Opportunistic bounded cleanup: no scheduled task or full-table sweep.
   delete from public.parenting_playground_positions where (region_id,day,child_id) in
    (select region_id,day,child_id from public.parenting_playground_positions where created_at<now()-interval '8 days' order by created_at limit 100);
  end if;
 end if;
 select least(-340,coalesce(min(x),0)-160),greatest(340,coalesce(max(x),0)+160) into lo,hi from public.parenting_playground_positions where region_id=rid and day=today;
 select count(*) into n from public.parenting_playground_positions s join public.children k on k.id=s.child_id join public.families cf on cf.id=k.family_id
 where s.region_id=rid and s.day=today and cf.merged_into is null and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date
 and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province);
 lx:=case when p_day=today::text and p_left is not null then p_left else coalesce(pos.x,0)-1000 end;
 rx:=case when p_day=today::text and p_right is not null then p_right else coalesce(pos.x,0)+1000 end;
 select coalesce(jsonb_agg(a.item order by a.y,a.id),'[]'::jsonb) into members from (
  select coalesce(p.id,md5(rid::text||k.id::text)::uuid) id,s.y,jsonb_build_object('id',coalesce(p.id,md5(rid::text||k.id::text)::uuid),'nickname',concat_ws(' ',trim(cf.name),trim(k.name)),'status',coalesce(p.status,''),'sex',k.sex,'age_days',today-k.birth_date,'x',s.x,'y',s.y) item
  from public.parenting_playground_positions s join public.children k on k.id=s.child_id left join public.parenting_friend_profiles p on p.child_id=k.id join public.families cf on cf.id=k.family_id
  where s.region_id=rid and s.day=today and s.x between lx and rx and k.id<>p_child
  and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date and cf.merged_into is null
  and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province)
  order by s.x,s.child_id limit 150
 ) a;
 return jsonb_build_object('day',today,'timezone',r.timezone,'expires_at',(today+1)::timestamp at time zone r.timezone,
 'width',hi-lo,'min_x',lo,'max_x',hi,'height',520,'population',n,'left',lx,'right',rx,
 'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,today-c.birth_date),'x',coalesce(pos.x,0),'y',coalesce(pos.y,355)), 'members',members);
end $$;
revoke all on function public.playground_region(uuid),public.playground_auto_name() from public,anon,authenticated;
revoke all on function public.parenting_playground(uuid,integer,integer,text) from public,anon;
grant execute on function public.parenting_playground(uuid,integer,integer,text) to authenticated;
commit;
