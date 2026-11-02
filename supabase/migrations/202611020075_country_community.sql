begin;
-- Pre-launch cleanup: obsolete categories and retired features are discarded.
alter table public.neighborhood_posts drop constraint neighborhood_posts_category_check;
delete from public.neighborhood_posts where feature<>'boards' or category not in ('play','gear','development','discipline','feeding','solids','birth-supplies','postpartum','health','birth','travel');
alter table public.neighborhood_posts drop constraint neighborhood_posts_feature_check;
alter table public.neighborhood_posts add constraint neighborhood_posts_feature_check check(feature='boards');
alter table public.neighborhood_posts add constraint neighborhood_posts_category_check
 check(category in ('play','gear','development','discipline','feeding','solids','birth-supplies','postpartum','health','birth','travel'));
alter table public.neighborhood_posts alter column category set default 'play';
create index neighborhood_country_feed on public.neighborhood_posts(country,created_at desc,id desc) where feature='boards';
create index neighborhood_country_topic_feed on public.neighborhood_posts(country,category,created_at desc,id desc) where feature='boards';

drop function public.parenting_feed(uuid,text,text,timestamptz,text,text,uuid);
create function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 a:=public.community_home_area(p_family);
 return query select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid()
 from public.neighborhood_posts p where p.feature='boards' and p.country=a->>'country'
 and (not p_neighborhood or (p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality'))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 50;
end $$;
drop function public.save_parenting_post(uuid,text,text,text,text,text);
create function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$ declare pid uuid; a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 a:=public.community_home_area(p_family);
 if nullif(a->>'country','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_posts(region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality)
 values(a->>'country'||':'||lower(coalesce(a->>'district','')),'boards',p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality') returning id into pid;
 return pid;
end $$;
create or replace function public.parenting_topics(p_family uuid) returns table(category text,posts bigint)
language plpgsql stable security definer set search_path='' as $$
declare country_code text; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 select residence_country_code into country_code from public.families where id=p_family;
 return query with topics as (
 select t.topic,t.ordinal from unnest(array['play','gear','development','discipline','feeding','solids','birth-supplies','postpartum','health','birth','travel']) with ordinality t(topic,ordinal)
 ), counts as (
 select p.category,count(*) total from public.neighborhood_posts p where p.feature='boards' and p.country=country_code
 and p.created_at >= (date_trunc('week',now() at time zone 'UTC') at time zone 'UTC') group by p.category
 ) select t.topic,coalesce(c.total,0) from topics t left join counts c on c.category=t.topic order by coalesce(c.total,0) desc,t.ordinal;
end $$;
revoke all on function public.parenting_topics(uuid) from public,anon;
grant execute on function public.parenting_topics(uuid) to authenticated;
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid),public.save_parenting_post(uuid,text,text,text) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid),public.save_parenting_post(uuid,text,text,text) to authenticated;
-- Remove obsolete browse/market entry points and profile-only roster.
drop function if exists public.save_neighborhood_post(uuid,text,text,text);
drop function if exists public.neighborhood_feed(uuid,text);
drop function if exists public.community_selected_area(uuid,text);
drop function if exists public.parenting_friends(uuid,text,text,timestamptz,uuid);
commit;
