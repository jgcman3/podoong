begin;
create function public.parenting_post_visible(p_post uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.neighborhood_posts p where p.id=p_post and p.feature='boards' and
 (p.author_id=auth.uid() or exists(select 1 from public.family_members m join public.families f on f.id=m.family_id where m.user_id=auth.uid() and f.merged_into is null and f.residence_country_code=p.country)));
$$;
revoke all on function public.parenting_post_visible(uuid) from public,anon;
grant execute on function public.parenting_post_visible(uuid) to authenticated;
create table public.parenting_post_photos (
 id uuid primary key,post_id uuid not null references public.neighborhood_posts on delete cascade,
 path text not null unique,sort_order integer not null check(sort_order between 0 and 4),unique(post_id,sort_order)
);
alter table public.parenting_post_photos enable row level security;
revoke all on public.parenting_post_photos from public,anon,authenticated;
grant select on public.parenting_post_photos to authenticated;
grant all on public.parenting_post_photos to service_role;
create policy parenting_photo_read on public.parenting_post_photos for select to authenticated using(public.parenting_post_visible(post_id));
create function public.queue_parenting_photo_delete() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.community_photo_cleanup(path) values(old.path),(replace(old.path,'.webp','-480.webp')) on conflict do nothing; return old;
end $$;
revoke all on function public.queue_parenting_photo_delete() from public,anon,authenticated;
create trigger parenting_photo_delete after delete on public.parenting_post_photos for each row execute function public.queue_parenting_photo_delete();
create or replace function public.queue_orphan_photos() returns integer language plpgsql security definer set search_path='' as $$ declare n integer; m integer; begin
 insert into public.community_photo_cleanup(path) select o.name from storage.objects o where bucket_id='community-photos' and created_at<now()-interval '24 hours'
 and not exists(select 1 from public.community_photos p where p.path=o.name)
 and not exists(select 1 from public.parenting_post_photos p where o.name in(p.path,replace(p.path,'.webp','-480.webp'))) on conflict do nothing;
 get diagnostics n=row_count;
 insert into public.child_photo_cleanup(path) select o.name from storage.objects o where bucket_id='child-care-photos' and created_at<now()-interval '24 hours'
 and not exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(o.name))
 and not exists(select 1 from public.child_app_icons i where i.path=o.name) on conflict do nothing;
 get diagnostics m=row_count; return n+m;
end $$;
drop function public.save_parenting_post(uuid,text,text,text);
create function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text,p_id uuid default gen_random_uuid(),p_photo_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$ declare a jsonb; photo uuid; object_path text; idx integer:=0; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_photo_ids is null or cardinality(p_photo_ids)>5 or (select count(distinct x) from unnest(p_photo_ids) x)<>cardinality(p_photo_ids) then raise exception 'invalid photos' using errcode='22023'; end if;
 a:=public.community_home_area(p_family);
 if nullif(a->>'country','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality)
 values(p_id,a->>'country'||':'||lower(coalesce(a->>'district','')),'boards',p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality');
 foreach photo in array p_photo_ids loop
  object_path:=auth.uid()::text||'/neighborhood/'||p_id::text||'/'||photo::text||'.webp';
  if (select count(*) from storage.objects where bucket_id='community-photos' and name in(object_path,replace(object_path,'.webp','-480.webp')) and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint between 1 and 5242880)<>2 then raise exception 'photo_missing' using errcode='22023'; end if;
  insert into public.parenting_post_photos(id,post_id,path,sort_order) values(photo,p_id,object_path,idx);idx:=idx+1;
 end loop;
 return p_id;
end $$;
revoke all on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[]) from public,anon;
grant execute on function public.save_parenting_post(uuid,text,text,text,uuid,uuid[]) to authenticated;
drop function public.parenting_feed(uuid,boolean,text,timestamptz,uuid);
create function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[])
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 a:=public.community_home_area(p_family);
 return query select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order)
 from public.neighborhood_posts p where p.feature='boards' and p.country=a->>'country'
 and (not p_neighborhood or (p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality'))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 50;
end $$;
revoke all on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) from public,anon;
grant execute on function public.parenting_feed(uuid,boolean,text,timestamptz,uuid) to authenticated;
commit;
