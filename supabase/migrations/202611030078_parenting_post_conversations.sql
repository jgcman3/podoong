begin;
alter table public.parenting_post_photos drop constraint parenting_post_photos_sort_order_check;
alter table public.parenting_post_photos add constraint parenting_post_photos_sort_order_check check(sort_order between 0 and 8);
alter table public.neighborhood_posts add column author_identity jsonb not null default '{"family":"","child":"","relationship":"guardian"}' ;
update public.neighborhood_posts p set author_identity=jsonb_build_object('family',f.name,'child','','relationship',coalesce((select m.relationship::text from public.family_members m where m.family_id=f.id and m.user_id=p.author_id),'guardian')) from public.families f where f.id=p.family_id;
create table public.parenting_post_likes(post_id uuid references public.neighborhood_posts on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(post_id,user_id));
create table public.parenting_post_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.neighborhood_posts on delete cascade,user_id uuid not null references public.profiles on delete cascade,body text not null check(length(trim(body)) between 1 and 1000),author_identity jsonb not null,created_at timestamptz not null default now());
create index parenting_comment_page on public.parenting_post_comments(post_id,created_at,id);
create table public.parenting_post_polls(post_id uuid primary key references public.neighborhood_posts on delete cascade,question text not null check(length(trim(question)) between 1 and 150),options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6));
create table public.parenting_post_votes(post_id uuid references public.parenting_post_polls on delete cascade,user_id uuid references public.profiles on delete cascade,option_index integer not null check(option_index between 0 and 5),primary key(post_id,user_id));
create table public.parenting_post_announcements(post_id uuid references public.neighborhood_posts on delete cascade,user_id uuid references public.profiles on delete cascade,country text not null,city text not null,district text not null,locality text not null,primary key(post_id,user_id));
create index parenting_announced_area on public.parenting_post_announcements(country,city,district,locality,post_id);
do $$declare t text;begin foreach t in array array['parenting_post_likes','parenting_post_comments','parenting_post_polls','parenting_post_votes','parenting_post_announcements'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create function public.parenting_identity(p_family uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare v jsonb;begin
 if not public.account_active() then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('family',f.name,'child',c.name,'relationship',m.relationship) into v from public.families f join public.family_members m on m.family_id=f.id and m.user_id=auth.uid() join public.children c on c.family_id=f.id and c.id=p_child where f.id=p_family and f.merged_into is null;
 if v is null then raise exception 'forbidden' using errcode='42501';end if;return v;
end $$;
revoke all on function public.parenting_identity(uuid,uuid) from public,anon,authenticated;
drop function public.save_parenting_post(uuid,text,text,text,uuid,uuid[]);
create function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text,p_id uuid default gen_random_uuid(),p_photo_ids uuid[] default '{}',p_child uuid default null,p_poll jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare a jsonb; photo uuid; object_path text; idx integer:=0; identity jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_photo_ids is null or cardinality(p_photo_ids)>9 or (select count(distinct x) from unnest(p_photo_ids) x)<>cardinality(p_photo_ids) then raise exception 'invalid photos' using errcode='22023'; end if;
 identity:=public.parenting_identity(p_family,p_child);
 a:=public.community_home_area(p_family);
 if nullif(a->>'country','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality,author_identity)
 values(p_id,a->>'country'||':'||lower(coalesce(a->>'district','')),'boards',p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality',identity);
 foreach photo in array p_photo_ids loop
  object_path:=auth.uid()::text||'/neighborhood/'||p_id::text||'/'||photo::text||'.webp';
  if (select count(*) from storage.objects where bucket_id='community-photos' and name in(object_path,replace(object_path,'.webp','-480.webp')) and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint between 1 and 5242880)<>2 then raise exception 'photo_missing' using errcode='22023'; end if;
  insert into public.parenting_post_photos(id,post_id,path,sort_order) values(photo,p_id,object_path,idx);idx:=idx+1;
 end loop;
 if p_poll is not null then
  if jsonb_typeof(p_poll)<>'object' or p_poll->>'question' is null or length(trim(p_poll->>'question')) not between 1 and 150 or jsonb_typeof(p_poll->'options') is distinct from 'array' then raise exception 'invalid poll' using errcode='22023';end if;
  if jsonb_array_length(p_poll->'options') not between 2 and 6 or exists(select 1 from jsonb_array_elements(p_poll->'options') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 80) or (select count(distinct lower(trim(v))) from jsonb_array_elements_text(p_poll->'options') v)<>jsonb_array_length(p_poll->'options') then raise exception 'invalid poll' using errcode='22023';end if;
  insert into public.parenting_post_polls(post_id,question,options) values(p_id,trim(p_poll->>'question'),p_poll->'options');
 end if;
 return p_id;
end $$;
revoke all on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb) from public,anon;
grant execute on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb) to authenticated;
drop function public.parenting_feed(uuid,boolean,text,timestamptz,uuid);
create function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 a:=public.community_home_area(p_family);
 return query select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order),p.author_identity,(select count(*) from public.parenting_post_likes l where l.post_id=p.id),(select count(*) from public.parenting_post_comments c where c.post_id=p.id)
 from public.neighborhood_posts p where p.feature='boards' and p.country=a->>'country'
 and (not p_neighborhood or (p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality') or exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.country=a->>'country' and n.city=a->>'city' and n.district=a->>'district' and n.locality=a->>'locality'))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 50;
end $$;
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) to authenticated;

create function public.parenting_post_detail(p_post uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'category',p.category,'author',p.author_identity,'created_at',p.created_at,'area',concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,p.area_locality),
 'photos',coalesce((select jsonb_agg(x.id order by x.sort_order) from public.parenting_post_photos x where x.post_id=p.id),'[]'::jsonb),
 'likes',(select count(*) from public.parenting_post_likes l where l.post_id=p.id),'liked',exists(select 1 from public.parenting_post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
 'announced',exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.user_id=auth.uid()),
 'comment_count',(select count(*) from public.parenting_post_comments c where c.post_id=p.id),
 'poll',(select jsonb_build_object('question',q.question,'options',q.options,'total',(select count(*) from public.parenting_post_votes v where v.post_id=p.id),'mine',(select v.option_index from public.parenting_post_votes v where v.post_id=p.id and v.user_id=auth.uid()),'counts',(select coalesce(jsonb_object_agg(x.option_index,x.n),'{}'::jsonb) from (select v.option_index,count(*) n from public.parenting_post_votes v where v.post_id=p.id group by v.option_index)x)) from public.parenting_post_polls q where q.post_id=p.id)) into result from public.neighborhood_posts p where p.id=p_post;
 return result;
end $$;
create function public.parenting_post_comments_page(p_post uuid,p_after timestamptz default null,p_after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (select c.id,c.body,c.author_identity as author,c.created_at from public.parenting_post_comments c where c.post_id=p_post and (p_after is null or (c.created_at,c.id)>(p_after,p_after_id)) order by c.created_at,c.id limit 30)x),'[]'::jsonb);
end $$;
create function public.parenting_post_interact(p_post uuid,p_child uuid,p_kind text,p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare fid uuid;identity jsonb;a jsonb;options_count integer;comment_data jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select family_id into fid from public.children where id=p_child;
 identity:=public.parenting_identity(fid,p_child);
 if p_kind='like' and p_value in ('on','off') then
  if p_value='on' then insert into public.parenting_post_likes values(p_post,auth.uid()) on conflict do nothing;else delete from public.parenting_post_likes where post_id=p_post and user_id=auth.uid();end if;
 elsif p_kind='announce' and p_value in ('on','off') then
  if p_value='off' then delete from public.parenting_post_announcements where post_id=p_post and user_id=auth.uid();else
   a:=public.community_home_area(fid);
   if nullif(a->>'locality','') is null or nullif(a->>'city','') is null or nullif(a->>'district','') is null or (select country from public.neighborhood_posts where id=p_post) is distinct from a->>'country' then raise exception 'residence_required' using errcode='22023';end if;
   insert into public.parenting_post_announcements values(p_post,auth.uid(),a->>'country',a->>'city',a->>'district',a->>'locality') on conflict(post_id,user_id) do update set country=excluded.country,city=excluded.city,district=excluded.district,locality=excluded.locality;
  end if;
 elsif p_kind='comment' then
  if p_value is null or length(trim(p_value)) not between 1 and 1000 then raise exception 'invalid comment' using errcode='22023';end if;
  insert into public.parenting_post_comments(post_id,user_id,body,author_identity) values(p_post,auth.uid(),trim(p_value),identity) returning jsonb_build_object('id',id,'body',body,'author',author_identity,'created_at',created_at) into comment_data;
 elsif p_kind='vote' then
  select jsonb_array_length(options) into options_count from public.parenting_post_polls where post_id=p_post;
  if p_value is null or p_value!~'^[0-5]$' or options_count is null or p_value::integer>=options_count then raise exception 'invalid option' using errcode='22023';end if;
  insert into public.parenting_post_votes values(p_post,auth.uid(),p_value::integer) on conflict(post_id,user_id) do update set option_index=excluded.option_index;
 else raise exception 'invalid action' using errcode='22023';end if;
return comment_data;
end $$;
revoke all on function public.parenting_post_detail(uuid),public.parenting_post_comments_page(uuid,timestamptz,uuid),public.parenting_post_interact(uuid,uuid,text,text) from public,anon;
grant execute on function public.parenting_post_detail(uuid),public.parenting_post_comments_page(uuid,timestamptz,uuid),public.parenting_post_interact(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
