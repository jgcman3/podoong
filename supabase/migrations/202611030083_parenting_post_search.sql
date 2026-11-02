begin;
create extension if not exists pg_trgm with schema extensions;
create index parenting_posts_search_text on public.neighborhood_posts using gin ((title||' '||body) extensions.gin_trgm_ops) where feature='boards';
drop function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint);
create function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null,p_sort text default 'all',p_before_score bigint default null,p_query text default '')
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint,views bigint,rank_score bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; needle text; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_sort is null or p_sort not in ('all','popular') then raise exception 'invalid sort' using errcode='22023';end if;
 if p_query is null or length(p_query)>80 then raise exception 'invalid search' using errcode='22023';end if;
 needle:='%'||replace(replace(replace(btrim(p_query),E'\\',E'\\\\'), '%',E'\\%'),'_',E'\\_')||'%';
 a:=public.community_home_area(p_family);
 return query with candidates as (select p.*,
 (select count(*) from public.parenting_post_likes l where l.post_id=p.id) as like_count,
 (select count(*) from public.parenting_post_comments c where c.post_id=p.id) as comments_count,
 (select count(distinct c.user_id) from public.parenting_post_comments c where c.post_id=p.id) as commenters
 from public.neighborhood_posts p where p.country=a->>'country' and p.feature='boards' and (btrim(p_query)='' or (p.title||' '||p.body) ilike needle) and (p_sort='all' or p.created_at>=now()-interval '7 days')),
 ranked as(select p.*,p.like_count*4+p.commenters*3+p.view_count as score from candidates p)
 select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order),p.author_identity,p.like_count,p.comments_count,p.view_count,p.score
 from ranked p where p.feature='boards' and p.country=a->>'country'
 and ((not p_neighborhood and p.audience='country') or (p_neighborhood and ((p.audience='neighborhood' and p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality') or (p.audience='country' and exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.country=a->>'country' and n.city=a->>'city' and n.district=a->>'district' and n.locality=a->>'locality')))))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or (p_sort='all' and (p.created_at,p.id)<(p_before,p_before_id)) or (p_sort='popular' and (p.score,p.created_at,p.id)<(p_before_score,p_before,p_before_id)))
 order by case when p_sort='popular' then p.score end desc,p.created_at desc,p.id desc limit 50;
end $$;
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint,text) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint,text) to authenticated;

notify pgrst,'reload schema';
commit;
