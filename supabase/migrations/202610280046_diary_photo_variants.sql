begin;
alter table public.child_record_photos add column variants_ready boolean not null default false;
create index growth_records_feed_order on public.child_records(occurred_at desc,id) where service='growth';
create index child_photos_record_order on public.child_record_photos(record_id,sort_order,created_at,id);
create function public.child_photo_original_path(p_path text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(p_path,'\.display-v1-(480|1600)\.webp$','');
$$;
create or replace function public.child_photo_access(p_path text,p_upload boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(p_path)
 and case when p_upload then p.uploaded_by=auth.uid() and public.can_write_child(p.child_id)
 else public.can_read_child(p.child_id) and (p.path=p_path or p.variants_ready) end);
$$;
create or replace function public.growth_diary_photo_by_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(p_path)
 and (p.path=p_path or p.variants_ready) and public.growth_diary_photo_allowed(p.record_id));
$$;
create function public.complete_child_photo_variants(p_photo uuid) returns void language plpgsql security definer set search_path='' as $$ declare p public.child_record_photos; begin
 select * into p from public.child_record_photos where id=p_photo for update;
 if p.id is null or (auth.role() is distinct from 'service_role' and (p.uploaded_by is distinct from auth.uid() or not public.can_write_child(p.child_id))) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select count(*) from storage.objects where bucket_id='child-care-photos' and name in (p.path||'.display-v1-480.webp',p.path||'.display-v1-1600.webp'))<>2 then raise exception 'variants_missing' using errcode='23514'; end if;
 update public.child_record_photos set variants_ready=true where id=p_photo;
end $$;
revoke all on function public.complete_child_photo_variants(uuid) from public,anon;
grant execute on function public.complete_child_photo_variants(uuid) to authenticated,service_role;
create or replace function public.queue_child_photo_delete() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.child_photo_cleanup(path) values(old.path),(old.path||'.display-v1-480.webp'),(old.path||'.display-v1-1600.webp') on conflict do nothing;
 return old;
end $$;
create or replace function public.queue_orphan_photos() returns integer language plpgsql security definer set search_path='' as $$ declare n integer; m integer; begin
 insert into public.community_photo_cleanup(path) select o.name from storage.objects o where bucket_id='community-photos' and created_at<now()-interval '24 hours' and not exists(select 1 from public.community_photos p where p.path=o.name) on conflict do nothing;
 get diagnostics n=row_count;
 insert into public.child_photo_cleanup(path) select o.name from storage.objects o where bucket_id='child-care-photos' and created_at<now()-interval '24 hours' and not exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(o.name)) on conflict do nothing;
 get diagnostics m=row_count; return n+m;
end $$;
drop function public.growth_diary_photo(uuid);
create function public.growth_diary_photo(p_id uuid) returns table(path text,content_type text,variants_ready boolean)
language sql stable security definer set search_path='' as $$
 select p.path,p.content_type,p.variants_ready from public.child_record_photos p where p.id=p_id and public.growth_diary_photo_allowed(p.record_id);
$$;
drop function public.diary_link_photo(text,uuid);
create function public.diary_link_photo(p_token text,p_photo uuid) returns table(path text,content_type text,variants_ready boolean)
language sql stable security definer set search_path='' as $$
 select p.path,p.content_type,p.variants_ready from public.child_record_photos p where p.id=p_photo and p.record_id in(select public.child_diary_link_records(p_token));
$$;
revoke all on function public.growth_diary_photo(uuid),public.diary_link_photo(text,uuid) from public;
grant execute on function public.growth_diary_photo(uuid) to authenticated;
grant execute on function public.diary_link_photo(text,uuid) to anon,authenticated;
commit;
