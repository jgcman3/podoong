begin;
-- Keep existing food conversations when removing the separate solids category.
update public.neighborhood_posts set category='toddler-food' where category='solids';
alter table public.neighborhood_posts drop constraint neighborhood_posts_category_check;
alter table public.neighborhood_posts add constraint neighborhood_posts_category_check
 check(category in ('pediatrics','childcare','outings','gear','development','feeding','birth-supplies','postpartum','health','toddler-food','birth','travel'));

-- A separate, opt-in identity; family records and installation photos stay private.
create table public.parenting_friend_profiles (
 child_id uuid primary key references public.children(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(),
 nickname text not null check(length(trim(nickname)) between 1 and 40),
 status text not null default '' check(length(status)<=80 and status !~ E'[\n\r]'),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create index parenting_friend_feed on public.parenting_friend_profiles(created_at desc,id desc) where enabled;
alter table public.parenting_friend_profiles enable row level security;
revoke all on public.parenting_friend_profiles from public,anon,authenticated;
grant select on public.parenting_friend_profiles to authenticated;
grant all on public.parenting_friend_profiles to service_role;
create policy friend_profile_family_read on public.parenting_friend_profiles for select to authenticated
 using(public.account_active() and public.can_read_child(child_id));
create function public.save_parenting_friend(p_child uuid,p_nickname text,p_status text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare fid uuid; begin
 select family_id into fid from public.children where id=p_child;
 if not public.account_active() or fid is null or not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_enabled is null or nullif(trim(p_nickname),'') is null or length(trim(p_nickname))>40 or p_status is null or length(p_status)>80 or p_status ~ E'[\n\r]' then raise exception 'invalid profile' using errcode='22023'; end if;
 if p_enabled and nullif(public.community_home_area(fid)->>'district','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.parenting_friend_profiles(child_id,nickname,status,enabled) values(p_child,trim(p_nickname),trim(p_status),p_enabled)
 on conflict(child_id) do update set nickname=excluded.nickname,status=excluded.status,enabled=excluded.enabled;
end $$;
create function public.parenting_friends(p_family uuid,p_scope text default 'district',p_place text default '',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,nickname text,status text,sex text,age_days integer,area_label text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; today date; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_scope is null or p_scope not in ('all','city','district','locality') then raise exception 'invalid scope' using errcode='22023'; end if;
 a:=public.community_selected_area(p_family,p_place);
 select (now() at time zone timezone)::date into today from public.profiles where profiles.id=auth.uid();
 return query select p.id,p.nickname,p.status,c.sex,greatest(0,today-c.birth_date),concat_ws(' ',f.residence_city,f.residence_locality),p.created_at
 from public.parenting_friend_profiles p join public.children c on c.id=p.child_id join public.families f on f.id=c.family_id
 where p.enabled and f.merged_into is null and nullif(f.residence_city,'') is not null
 and (p_scope='all' or (f.residence_country_code=a->>'country' and public.community_home_area(f.id)->>'city'=a->>'city'
 and (case p_scope when 'city' then true when 'district' then f.residence_city=a->>'district' else f.residence_city=a->>'district' and f.residence_locality=a->>'locality' end)))
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 30;
end $$;
revoke all on function public.save_parenting_friend(uuid,text,text,boolean),public.parenting_friends(uuid,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.save_parenting_friend(uuid,text,text,boolean),public.parenting_friends(uuid,text,text,timestamptz,uuid) to authenticated;
commit;
