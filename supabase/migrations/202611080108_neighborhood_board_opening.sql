begin;
create index if not exists families_neighborhood_board_idx on public.families(residence_country_code,residence_city,residence_locality) where merged_into is null;

-- Only a capped total leaves the database, never another family's identity.
create or replace function public.neighborhood_family_count(p_family uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from (
  select f.id from public.families f join public.families home on home.id=p_family and home.merged_into is null
  where f.merged_into is null
   and nullif(f.residence_country_code,'') is not null
   and nullif(f.residence_city,'') is not null
   and nullif(f.residence_locality,'') is not null
   and f.residence_country_code=home.residence_country_code
   and f.residence_city=home.residence_city and f.residence_locality=home.residence_locality
   and (f.residence_country_code='KR' or coalesce(f.residence_province,'')=coalesce(home.residence_province,''))
   and exists(select 1 from public.children c where c.family_id=f.id)
   and exists(select 1 from public.family_members m where m.family_id=f.id)
  limit 3
 ) neighbors;
$$;
revoke all on function public.neighborhood_family_count(uuid) from public,anon,authenticated;

create table if not exists public.neighborhood_board_openings (
 region_key uuid primary key, opened_at timestamptz not null default now()
);
create table if not exists public.neighborhood_board_founders (
 region_key uuid not null references public.neighborhood_board_openings on delete cascade,
 family_id uuid not null references public.families on delete cascade,
 name text not null, position integer not null check(position between 1 and 3),
 primary key(region_key,family_id)
);
alter table public.neighborhood_board_openings enable row level security;
alter table public.neighborhood_board_founders enable row level security;
revoke all on public.neighborhood_board_openings, public.neighborhood_board_founders from anon,authenticated;

create or replace function public.neighborhood_board_is_open(p_family uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.neighborhood_board_openings
 where region_key=md5(public.community_home_area(p_family)::text)::uuid);
$$;
revoke all on function public.neighborhood_board_is_open(uuid) from public,anon,authenticated;

create or replace function public.neighborhood_board_status(p_family uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare families integer; region uuid; created uuid; founders jsonb;
begin
 if not public.account_active() or not public.is_family_member(p_family) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 region:=md5(public.community_home_area(p_family)::text)::uuid;
 families:=public.neighborhood_family_count(p_family);
 if families>=3 then
  insert into public.neighborhood_board_openings(region_key) values(region)
  on conflict do nothing returning region_key into created;
  if created is not null then
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
 end if;
 select coalesce(jsonb_agg(name order by position),'[]'::jsonb) into founders
 from public.neighborhood_board_founders where region_key=region;
 return jsonb_build_object('families',families,'open',public.neighborhood_board_is_open(p_family),'founders',founders);
end $$;
revoke all on function public.neighborhood_board_status(uuid) from public,anon;
grant execute on function public.neighborhood_board_status(uuid) to authenticated;

create or replace function public.require_open_neighborhood_board() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not public.neighborhood_board_is_open(new.family_id) then
  raise exception 'neighborhood_not_open' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.require_open_neighborhood_board() from public,anon,authenticated;
drop trigger if exists neighborhood_board_open_before_post on public.neighborhood_posts;
create trigger neighborhood_board_open_before_post before insert on public.neighborhood_posts
for each row execute function public.require_open_neighborhood_board();

create or replace function public.parenting_feed(p_family uuid,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null,p_sort text default 'all',p_before_score bigint default null,p_query text default '')
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint,views bigint,rank_score bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; needle text; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_sort is null or p_sort not in ('all','popular') then raise exception 'invalid sort' using errcode='22023';end if;
 if p_query is null or length(p_query)>80 then raise exception 'invalid search' using errcode='22023';end if;
 needle:='%'||replace(replace(replace(btrim(p_query),E'\\',E'\\\\'), '%',E'\\%'),'_',E'\\_')||'%';
 if not public.neighborhood_board_is_open(p_family) then return; end if;
 a:=public.community_home_area(p_family);
 return query with candidates as (select p.*,
 (select count(*) from public.parenting_post_likes l where l.post_id=p.id) as like_count,
 (select count(*) from public.parenting_post_comments c where c.post_id=p.id) as comments_count,
 (select count(distinct c.user_id) from public.parenting_post_comments c where c.post_id=p.id) as commenters
 from public.neighborhood_posts p where not p.hidden and p.country=a->>'country' and p.feature='boards' and (btrim(p_query)='' or (p.title||' '||p.body) ilike needle) and (p_sort='all' or p.created_at>=now()-interval '7 days')),
 ranked as(select p.*,p.like_count*4+p.commenters*3+p.view_count as score from candidates p)
 select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order),p.author_identity,p.like_count,p.comments_count,p.view_count,p.score
 from ranked p where p.feature='boards' and p.country=a->>'country'
 and p.audience='neighborhood' and p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality'
 and (p_category='all' or p.category=p_category)
 and (p_before is null or (p_sort='all' and (p.created_at,p.id)<(p_before,p_before_id)) or (p_sort='popular' and (p.score,p.created_at,p.id)<(p_before_score,p_before,p_before_id)))
 order by case when p_sort='popular' then p.score end desc,p.created_at desc,p.id desc limit 50;
end $$;

create or replace function public.parenting_post_visible(p_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.neighborhood_posts p where p.id=p_post and not p.hidden and p.feature='boards' and
 (p.author_id=auth.uid() and public.neighborhood_board_is_open(p.family_id) or exists(select 1 from public.family_members m join public.families f on f.id=m.family_id cross join lateral (select public.community_home_area(f.id) a) area where m.user_id=auth.uid() and f.merged_into is null and public.neighborhood_board_is_open(f.id) and f.residence_country_code=p.country and ((p.area_city=area.a->>'city' and p.area_district=area.a->>'district' and p.area_locality=area.a->>'locality')))));
$$;


commit;
