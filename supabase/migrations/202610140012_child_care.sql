create extension if not exists btree_gist with schema extensions;

create table public.child_records (
 id uuid primary key, child_id uuid not null references public.children on delete cascade,
 service text not null check(service in ('sleep','diaper','growth')),
 kind text not null, occurred_at timestamptz not null, ended_at timestamptz,
 height_cm numeric check(height_cm>0 and height_cm<=250),
 weight_kg numeric check(weight_kg>0 and weight_kg<=200),
 head_cm numeric check(head_cm>0 and head_cm<=100),
 stool_color text check(stool_color in ('yellow','green','brown','red','black','white','other')),
 stool_texture text check(stool_texture in ('watery','soft','firm','other')),
 title text not null default '' check(length(title)<=200),
 note text not null default '' check(length(note)<=2000),
 record_timezone text not null,
 created_by uuid references public.profiles on delete set null,
 updated_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 1, unique(id,child_id),
 check(ended_at is null or ended_at>=occurred_at),
 check((service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and length(trim(title))>0 and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null))
);
create index child_records_recent on public.child_records(child_id,service,occurred_at desc,id);
create unique index one_child_sleep_timer on public.child_records(child_id) where service='sleep' and ended_at is null;
alter table public.child_records add constraint sleep_no_overlap exclude using gist
 (child_id with =, tstzrange(occurred_at,ended_at,'[)') with &&) where(service='sleep' and ended_at is not null);
alter table public.child_records enable row level security;
revoke all on public.child_records from anon,authenticated;
grant select on public.child_records to authenticated;
create policy child_record_read on public.child_records for select to authenticated using(public.can_read_child(child_id));

create function public.save_child_record(p_id uuid,p_child uuid,p_service text,p_data jsonb,p_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.child_records; fid uuid;
begin
 if not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timezone') then raise exception 'invalid timezone' using errcode='22023'; end if;
 perform 1 from public.children where id=p_child for update;
 select * into old from public.child_records where id=p_id for update;
 if old.id is not null then
  if old.child_id<>p_child or old.service<>p_service then raise exception 'forbidden' using errcode='42501'; end if;
  if p_version is null then
   if old.created_by=auth.uid() then return p_id; end if;
   raise exception 'conflict';
  end if;
  if old.version<>p_version then raise exception 'conflict'; end if;
 elsif p_version is not null then raise exception 'conflict'; end if;
 insert into public.child_records(id,child_id,service,kind,occurred_at,ended_at,height_cm,weight_kg,head_cm,stool_color,stool_texture,title,note,record_timezone,created_by,updated_by)
 values(p_id,p_child,p_service,p_data->>'kind',(p_data->>'occurred_at')::timestamptz,nullif(p_data->>'ended_at','')::timestamptz,
 nullif(p_data->>'height_cm','')::numeric,nullif(p_data->>'weight_kg','')::numeric,nullif(p_data->>'head_cm','')::numeric,
 nullif(p_data->>'stool_color',''),nullif(p_data->>'stool_texture',''),coalesce(p_data->>'title',''),coalesce(p_data->>'note',''),p_data->>'timezone',auth.uid(),auth.uid())
 on conflict(id) do update set kind=excluded.kind,occurred_at=excluded.occurred_at,ended_at=excluded.ended_at,
 height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,head_cm=excluded.head_cm,stool_color=excluded.stool_color,stool_texture=excluded.stool_texture,
 title=excluded.title,note=excluded.note,record_timezone=excluded.record_timezone,updated_by=auth.uid(),updated_at=now(),version=child_records.version+1;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),p_service||'_saved',p_id);
 return p_id;
end $$;
create function public.delete_child_record(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.child_records; fid uuid; begin
 select * into r from public.child_records where id=p_id for update;
 if r.id is null or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into fid from public.children where id=r.child_id;
 delete from public.child_records where id=p_id;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),r.service||'_deleted',p_id);
end $$;
revoke all on function public.save_child_record(uuid,uuid,text,jsonb,integer),public.delete_child_record(uuid) from public,anon;
grant execute on function public.save_child_record(uuid,uuid,text,jsonb,integer),public.delete_child_record(uuid) to authenticated;

create table public.child_record_photos (
 id uuid primary key,record_id uuid not null,child_id uuid not null,
 path text not null unique,content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 size_bytes bigint not null check(size_bytes between 1 and 5242880),
 uploaded_by uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 foreign key(record_id,child_id) references public.child_records(id,child_id) on delete cascade
);
alter table public.child_record_photos enable row level security;
revoke all on public.child_record_photos from anon,authenticated;
grant select on public.child_record_photos to authenticated;
create policy child_photo_read on public.child_record_photos for select to authenticated using(public.can_read_child(child_id));
create table public.child_photo_cleanup(path text primary key);
alter table public.child_photo_cleanup enable row level security;
revoke all on public.child_photo_cleanup from public,anon,authenticated;
grant all on public.child_photo_cleanup to service_role;
create function public.queue_child_photo_delete() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.child_photo_cleanup(path) values(old.path) on conflict do nothing; return old;
end $$;
create trigger child_photo_deleted after delete on public.child_record_photos for each row execute function public.queue_child_photo_delete();
create function public.queue_profile_child_photos() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.child_photo_cleanup(path) select name from storage.objects where bucket_id='child-care-photos' and split_part(name,'/',1)=old.id::text on conflict do nothing;
 return old;
end $$;
create trigger profile_child_photos_deleting before delete on public.profiles for each row execute function public.queue_profile_child_photos();
revoke all on function public.queue_child_photo_delete(),public.queue_profile_child_photos() from public,anon,authenticated;

create function public.add_child_record_photo(p_id uuid,p_record uuid,p_type text,p_size bigint) returns text language plpgsql security definer set search_path='' as $$
declare r public.child_records; object_path text; begin
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or r.service<>'growth' or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select count(*) from public.child_record_photos where record_id=p_record)>=4 then raise exception 'photo limit' using errcode='23514'; end if;
 object_path:=auth.uid()::text||'/'||r.child_id||'/'||r.id||'/'||p_id||case p_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
 insert into public.child_record_photos(id,record_id,child_id,path,content_type,size_bytes,uploaded_by) values(p_id,r.id,r.child_id,object_path,p_type,p_size,auth.uid());
 return object_path;
end $$;
create function public.remove_child_record_photo(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid; begin
 select child_id into cid from public.child_record_photos where id=p_id;
 if cid is null or not public.can_write_child(cid) then raise exception 'forbidden' using errcode='42501'; end if;
 delete from public.child_record_photos where id=p_id;
end $$;
create function public.child_photo_access(p_path text,p_upload boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.child_record_photos p where p.path=p_path and case when p_upload then p.uploaded_by=auth.uid() and public.can_write_child(p.child_id) else public.can_read_child(p.child_id) end);
$$;
revoke all on function public.add_child_record_photo(uuid,uuid,text,bigint),public.remove_child_record_photo(uuid),public.child_photo_access(text,boolean) from public,anon;
grant execute on function public.add_child_record_photo(uuid,uuid,text,bigint),public.remove_child_record_photo(uuid),public.child_photo_access(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('child-care-photos','child-care-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy child_care_photo_read on storage.objects for select to authenticated using(bucket_id='child-care-photos' and public.child_photo_access(name,false));
create policy child_care_photo_upload on storage.objects for insert to authenticated with check(bucket_id='child-care-photos' and public.child_photo_access(name,true));

create or replace function public.account_has_storage(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from storage.objects where bucket_id in ('community-photos','child-care-photos') and split_part(name,'/',1)=p_user::text);
$$;
create or replace function public.queue_orphan_photos() returns integer language plpgsql security definer set search_path='' as $$ declare n integer; m integer; begin
 insert into public.community_photo_cleanup(path) select o.name from storage.objects o where bucket_id='community-photos' and created_at<now()-interval '24 hours' and not exists(select 1 from public.community_photos p where p.path=o.name) on conflict do nothing;
 get diagnostics n=row_count;
 insert into public.child_photo_cleanup(path) select o.name from storage.objects o where bucket_id='child-care-photos' and created_at<now()-interval '24 hours' and not exists(select 1 from public.child_record_photos p where p.path=o.name) on conflict do nothing;
 get diagnostics m=row_count; return n+m;
end $$;
create or replace function public.export_child_data(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('format_version',2,'exported_at',now(),'timestamps','UTC ISO-8601',
 'child',(select to_jsonb(c)-'family_id' from public.children c where id=p_child),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by started_at,id) from public.care_records r where child_id=p_child),'[]'::jsonb),
 'child_records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by occurred_at,id) from public.child_records r where child_id=p_child),'[]'::jsonb),
 'child_photos',coalesce((select jsonb_agg(to_jsonb(p)-'uploaded_by'-'path' order by created_at,id) from public.child_record_photos p where child_id=p_child),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'created_by'-'assignee_id' order by due_date,id) from public.tasks t where child_id=p_child),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)-'created_by' order by date,id) from public.events e where child_id=p_child),'[]'::jsonb));
end $$;

create function public.child_record_day_count(p_child uuid,p_service text,p_day date,p_timezone text) returns integer language plpgsql stable security definer set search_path='' as $$
declare total integer; begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid timezone' using errcode='22023'; end if;
 select count(*)::int into total from public.child_records where child_id=p_child and service=p_service and (occurred_at at time zone p_timezone)::date=p_day;
 return total;
end $$;
revoke all on function public.child_record_day_count(uuid,text,date,text) from public,anon;
grant execute on function public.child_record_day_count(uuid,text,date,text) to authenticated;
