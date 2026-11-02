begin;
alter table public.neighborhood_posts add column view_count bigint not null default 0 check(view_count>=0);
create table public.parenting_post_views(post_id uuid references public.neighborhood_posts on delete cascade,user_id uuid references public.profiles on delete cascade,view_day date not null,primary key(post_id,user_id,view_day));
create index parenting_view_user on public.parenting_post_views(user_id,view_day);
alter table public.parenting_post_views enable row level security;
revoke all on public.parenting_post_views from public,anon,authenticated;
grant all on public.parenting_post_views to service_role;
create function public.record_parenting_post_view(p_post uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare n integer;total bigint;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 insert into public.parenting_post_views values(p_post,auth.uid(),(now() at time zone 'UTC')::date) on conflict do nothing;
 get diagnostics n=row_count;
 if n=1 then
 delete from public.parenting_post_views where ctid in(select ctid from public.parenting_post_views where user_id=auth.uid() and view_day<(now() at time zone 'UTC')::date-30 limit 100);
 update public.neighborhood_posts set view_count=view_count+1 where id=p_post returning view_count into total;
 else select view_count into total from public.neighborhood_posts where id=p_post;end if;
 return jsonb_build_object('views',total,'recorded',n=1);
end $$;
revoke all on function public.record_parenting_post_view(uuid) from public,anon;
grant execute on function public.record_parenting_post_view(uuid) to authenticated;
update public.neighborhood_posts p set author_identity=p.author_identity||jsonb_build_object('initial',left(coalesce(nullif(trim(pro.display_name),''),'?'),1)) from public.profiles pro where pro.id=p.author_id;
update public.parenting_post_comments c set author_identity=c.author_identity||jsonb_build_object('initial',left(coalesce(nullif(trim(pro.display_name),''),'?'),1)) from public.profiles pro where pro.id=c.user_id;
drop function public.parenting_feed(uuid,boolean,text,timestamptz,uuid);
create or replace function public.parenting_identity(p_family uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare v jsonb;begin
 if not public.account_active() then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('family',f.name,'child',c.name,'relationship',m.relationship,'initial',left(coalesce(nullif(trim(pro.display_name),''),'?'),1)) into v from public.families f join public.family_members m on m.family_id=f.id and m.user_id=auth.uid() join public.children c on c.family_id=f.id and c.id=p_child join public.profiles pro on pro.id=m.user_id where f.id=p_family and f.merged_into is null;
 if v is null then raise exception 'forbidden' using errcode='42501';end if;return v;
end $$;
revoke all on function public.parenting_identity(uuid,uuid) from public,anon,authenticated;
create function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null,p_sort text default 'all',p_before_score bigint default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint,views bigint,rank_score bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_sort is null or p_sort not in ('all','popular') then raise exception 'invalid sort' using errcode='22023';end if;
 a:=public.community_home_area(p_family);
 return query with candidates as (select p.*,
 (select count(*) from public.parenting_post_likes l where l.post_id=p.id) as like_count,
 (select count(*) from public.parenting_post_comments c where c.post_id=p.id) as comments_count,
 (select count(distinct c.user_id) from public.parenting_post_comments c where c.post_id=p.id) as commenters
 from public.neighborhood_posts p where p.country=a->>'country' and p.feature='boards' and (p_sort='all' or p.created_at>=now()-interval '7 days')),
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
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint) to authenticated;

create or replace function public.parenting_post_detail(p_post uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'views',p.view_count,'audience',p.audience,'mine',coalesce(p.author_id=auth.uid(),false),'title',p.title,'body',p.body,'category',p.category,'author',p.author_identity,'created_at',p.created_at,'area',concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,p.area_locality),
 'photos',coalesce((select jsonb_agg(x.id order by x.sort_order) from public.parenting_post_photos x where x.post_id=p.id),'[]'::jsonb),
 'likes',(select count(*) from public.parenting_post_likes l where l.post_id=p.id),'liked',exists(select 1 from public.parenting_post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
 'announced',exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.user_id=auth.uid()),
 'comment_count',(select count(*) from public.parenting_post_comments c where c.post_id=p.id),
 'poll',(select jsonb_build_object('question',q.question,'options',q.options,'total',(select count(*) from public.parenting_post_votes v where v.post_id=p.id),'mine',(select v.option_index from public.parenting_post_votes v where v.post_id=p.id and v.user_id=auth.uid()),'counts',(select coalesce(jsonb_object_agg(x.option_index,x.n),'{}'::jsonb) from (select v.option_index,count(*) n from public.parenting_post_votes v where v.post_id=p.id group by v.option_index)x)) from public.parenting_post_polls q where q.post_id=p.id)) into result from public.neighborhood_posts p where p.id=p_post;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
