begin;
alter table public.neighborhood_posts add column audience text not null default 'country' check(audience in ('country','neighborhood'));
create index parenting_local_feed on public.neighborhood_posts(country,area_city,area_district,area_locality,created_at desc,id desc) where audience='neighborhood';
alter table public.parenting_post_photos drop constraint parenting_post_photos_post_id_sort_order_key;
alter table public.parenting_post_photos add constraint parenting_post_photos_post_id_sort_order_key unique(post_id,sort_order) deferrable initially deferred;
create or replace function public.parenting_post_visible(p_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.neighborhood_posts p where p.id=p_post and p.feature='boards' and
 (p.author_id=auth.uid() or exists(select 1 from public.family_members m join public.families f on f.id=m.family_id cross join lateral (select public.community_home_area(f.id) a) area where m.user_id=auth.uid() and f.merged_into is null and f.residence_country_code=p.country and (p.audience='country' or (p.area_city=area.a->>'city' and p.area_district=area.a->>'district' and p.area_locality=area.a->>'locality')))));
$$;
drop function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb);
create function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text,p_id uuid default gen_random_uuid(),p_photo_ids uuid[] default '{}',p_child uuid default null,p_poll jsonb default null,p_audience text default 'country') returns uuid
language plpgsql security definer set search_path='' as $$ declare a jsonb; photo uuid; object_path text; idx integer:=0; identity jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_photo_ids is null or cardinality(p_photo_ids)>9 or (select count(distinct x) from unnest(p_photo_ids) x)<>cardinality(p_photo_ids) then raise exception 'invalid photos' using errcode='22023'; end if;
 if p_audience is null or p_audience not in ('country','neighborhood') then raise exception 'invalid audience' using errcode='22023';end if;
 identity:=public.parenting_identity(p_family,p_child);
 a:=public.community_home_area(p_family);
 if nullif(a->>'country','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 if p_audience='neighborhood' and nullif(a->>'locality','') is null then raise exception 'residence_required' using errcode='22023';end if;
 insert into public.neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality,author_identity,audience)
 values(p_id,a->>'country'||':'||lower(coalesce(a->>'district','')),'boards',p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality',identity,p_audience);
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
revoke all on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb,text) from public,anon;
grant execute on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb,text) to authenticated;
create or replace function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 a:=public.community_home_area(p_family);
 return query select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order),p.author_identity,(select count(*) from public.parenting_post_likes l where l.post_id=p.id),(select count(*) from public.parenting_post_comments c where c.post_id=p.id)
 from public.neighborhood_posts p where p.feature='boards' and p.country=a->>'country'
 and ((not p_neighborhood and p.audience='country') or (p_neighborhood and ((p.audience='neighborhood' and p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality') or (p.audience='country' and exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.country=a->>'country' and n.city=a->>'city' and n.district=a->>'district' and n.locality=a->>'locality')))))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 50;
end $$;
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) to authenticated;

create or replace function public.parenting_post_detail(p_post uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'audience',p.audience,'mine',coalesce(p.author_id=auth.uid(),false),'title',p.title,'body',p.body,'category',p.category,'author',p.author_identity,'created_at',p.created_at,'area',concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,p.area_locality),
 'photos',coalesce((select jsonb_agg(x.id order by x.sort_order) from public.parenting_post_photos x where x.post_id=p.id),'[]'::jsonb),
 'likes',(select count(*) from public.parenting_post_likes l where l.post_id=p.id),'liked',exists(select 1 from public.parenting_post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
 'announced',exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.user_id=auth.uid()),
 'comment_count',(select count(*) from public.parenting_post_comments c where c.post_id=p.id),
 'poll',(select jsonb_build_object('question',q.question,'options',q.options,'total',(select count(*) from public.parenting_post_votes v where v.post_id=p.id),'mine',(select v.option_index from public.parenting_post_votes v where v.post_id=p.id and v.user_id=auth.uid()),'counts',(select coalesce(jsonb_object_agg(x.option_index,x.n),'{}'::jsonb) from (select v.option_index,count(*) n from public.parenting_post_votes v where v.post_id=p.id group by v.option_index)x)) from public.parenting_post_polls q where q.post_id=p.id)) into result from public.neighborhood_posts p where p.id=p_post;
 return result;
end $$;

create function public.edit_parenting_post(p_post uuid,p_category text,p_title text,p_body text,p_keep uuid[],p_new uuid[],p_poll jsonb default null) returns void language plpgsql security definer set search_path='' as $$declare photo uuid;object_path text;idx integer:=0;old_poll jsonb;begin
 if not public.account_active() then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.neighborhood_posts where id=p_post and author_id=auth.uid() and public.is_family_member(family_id) for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if p_keep is null or p_new is null or cardinality(p_keep)+cardinality(p_new)>9 or (select count(distinct x) from unnest(p_keep||p_new) x)<>cardinality(p_keep)+cardinality(p_new) or (select count(*) from public.parenting_post_photos where post_id=p_post and id=any(p_keep))<>cardinality(p_keep) then raise exception 'invalid photos' using errcode='22023';end if;
 if p_poll is not null then
  if jsonb_typeof(p_poll)<>'object' or jsonb_typeof(p_poll->'question') is distinct from 'string' or length(trim(p_poll->>'question')) not between 1 and 150 or jsonb_typeof(p_poll->'options') is distinct from 'array' then raise exception 'invalid poll' using errcode='22023';end if;
  if jsonb_array_length(p_poll->'options') not between 2 and 6 or exists(select 1 from jsonb_array_elements(p_poll->'options') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 80) or (select count(distinct lower(trim(v))) from jsonb_array_elements_text(p_poll->'options') v)<>jsonb_array_length(p_poll->'options') then raise exception 'invalid poll' using errcode='22023';end if;
 end if;
 select jsonb_build_object('question',question,'options',options) into old_poll from public.parenting_post_polls where post_id=p_post for update;
 if exists(select 1 from public.parenting_post_votes where post_id=p_post) and old_poll is distinct from p_poll then raise exception 'poll_has_votes' using errcode='22023';end if;
 update public.neighborhood_posts set category=p_category,title=p_title,body=p_body where id=p_post;
 delete from public.parenting_post_photos where post_id=p_post and not(id=any(p_keep));
 foreach photo in array p_keep loop update public.parenting_post_photos set sort_order=idx where id=photo and post_id=p_post;idx:=idx+1;end loop;
 foreach photo in array p_new loop
  object_path:=auth.uid()::text||'/neighborhood/'||p_post::text||'/'||photo::text||'.webp';
  if (select count(*) from storage.objects where bucket_id='community-photos' and name in(object_path,replace(object_path,'.webp','-480.webp')) and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint between 1 and 5242880)<>2 then raise exception 'photo_missing' using errcode='22023';end if;
  insert into public.parenting_post_photos values(photo,p_post,object_path,idx);idx:=idx+1;
 end loop;
 if p_poll is null then delete from public.parenting_post_polls where post_id=p_post;
 else insert into public.parenting_post_polls values(p_post,p_poll->>'question',p_poll->'options') on conflict(post_id) do update set question=excluded.question,options=excluded.options;end if;
end $$;
create function public.delete_parenting_post(p_post uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.account_active() then raise exception 'forbidden' using errcode='42501';end if;
 delete from public.neighborhood_posts where id=p_post and author_id=auth.uid() and public.is_family_member(family_id);
 if not found then raise exception 'forbidden' using errcode='42501';end if;
end $$;
revoke all on function public.edit_parenting_post(uuid,text,text,text,uuid[],uuid[],jsonb),public.delete_parenting_post(uuid) from public,anon;
grant execute on function public.edit_parenting_post(uuid,text,text,text,uuid[],uuid[],jsonb),public.delete_parenting_post(uuid) to authenticated;
create or replace function public.parenting_post_interact(p_post uuid,p_child uuid,p_kind text,p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare fid uuid;identity jsonb;a jsonb;options_count integer;comment_data jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select family_id into fid from public.children where id=p_child;
 identity:=public.parenting_identity(fid,p_child);
 if p_kind='like' and p_value in ('on','off') then
  if p_value='on' then insert into public.parenting_post_likes values(p_post,auth.uid()) on conflict do nothing;else delete from public.parenting_post_likes where post_id=p_post and user_id=auth.uid();end if;
 elsif p_kind='announce' and p_value in ('on','off') then
  if (select audience from public.neighborhood_posts where id=p_post)<>'country' then raise exception 'invalid audience' using errcode='22023';end if;
  if p_value='off' then delete from public.parenting_post_announcements where post_id=p_post and user_id=auth.uid();else
   a:=public.community_home_area(fid);
   if nullif(a->>'locality','') is null or nullif(a->>'city','') is null or nullif(a->>'district','') is null or (select country from public.neighborhood_posts where id=p_post) is distinct from a->>'country' then raise exception 'residence_required' using errcode='22023';end if;
   insert into public.parenting_post_announcements values(p_post,auth.uid(),a->>'country',a->>'city',a->>'district',a->>'locality') on conflict(post_id,user_id) do update set country=excluded.country,city=excluded.city,district=excluded.district,locality=excluded.locality;
  end if;
 elsif p_kind='comment' then
  if p_value is null or length(trim(p_value)) not between 1 and 1000 then raise exception 'invalid comment' using errcode='22023';end if;
  insert into public.parenting_post_comments(post_id,user_id,body,author_identity) values(p_post,auth.uid(),trim(p_value),identity) returning jsonb_build_object('id',id,'body',body,'author',author_identity,'created_at',created_at,'parent_id',parent_id,'likes',0,'liked',false,'reply_count',0) into comment_data;
 elsif p_kind='vote' then
  select jsonb_array_length(options) into options_count from public.parenting_post_polls where post_id=p_post for share;
  if p_value is null or p_value!~'^[0-5]$' or options_count is null or p_value::integer>=options_count then raise exception 'invalid option' using errcode='22023';end if;
  insert into public.parenting_post_votes values(p_post,auth.uid(),p_value::integer) on conflict(post_id,user_id) do update set option_index=excluded.option_index;
 else raise exception 'invalid action' using errcode='22023';end if;
return comment_data;
end $$;
create or replace function public.parenting_topics(p_family uuid) returns table(category text,posts bigint)
language plpgsql stable security definer set search_path='' as $$
declare country_code text; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 select residence_country_code into country_code from public.families where id=p_family;
 return query with topics as (
 select t.topic,t.ordinal from unnest(array['play','gear','development','discipline','feeding','solids','birth-supplies','postpartum','health','birth','travel']) with ordinality t(topic,ordinal)
 ), counts as (
 select p.category,count(*) total from public.neighborhood_posts p where p.feature='boards' and p.country=country_code and p.audience='country'
 and p.created_at >= (date_trunc('week',now() at time zone 'UTC') at time zone 'UTC') group by p.category
 ) select t.topic,coalesce(c.total,0) from topics t left join counts c on c.category=t.topic order by coalesce(c.total,0) desc,t.ordinal;
end $$;
revoke all on function public.parenting_topics(uuid) from public,anon;
grant execute on function public.parenting_topics(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
