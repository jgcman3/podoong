begin;
create or replace function public.save_received_record(p_id uuid,p_child uuid,p_data jsonb,p_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.child_records; fid uuid; k text := p_data->>'kind'; photo jsonb := nullif(p_data->'gift_photo','null'::jsonb); photo_id uuid; object_path text; byte_size bigint; removed uuid := nullif(p_data->>'remove_photo_id','')::uuid;
begin
 if not coalesce(public.can_write_child(p_child),false) then raise exception 'forbidden' using errcode='42501'; end if;
 if k is null or k not in ('gift','allowance') then raise exception 'invalid kind' using errcode='22023'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timezone') then raise exception 'invalid timezone' using errcode='22023'; end if;
 perform 1 from public.children where id=p_child for update;
 select * into old from public.child_records where id=p_id for update;
 if old.id is not null then
  if old.child_id<>p_child or old.service<>'activity' or old.kind<>k then raise exception 'forbidden' using errcode='42501'; end if;
  if p_version is null then
   if old.created_by=auth.uid() then return p_id; end if;
   raise exception 'conflict';
  end if;
  if old.version<>p_version then raise exception 'conflict'; end if;
 elsif p_version is not null then raise exception 'conflict'; end if;
 if k<>'gift' and (photo is not null or removed is not null) then raise exception 'invalid photo' using errcode='22023'; end if;
 if removed is not null and not exists(select 1 from public.child_record_photos where id=removed and record_id=p_id) then raise exception 'invalid photo removal' using errcode='22023'; end if;
 if photo is not null then
  photo_id := (photo->>'id')::uuid;
  byte_size := (photo->>'size')::bigint;
  object_path := auth.uid()::text||'/'||p_child||'/'||p_id||'/'||photo_id||'.webp';
  if jsonb_typeof(photo)<>'object' or photo_id is null or byte_size is null or byte_size not between 1 and 5242880 or photo->>'path' is distinct from object_path then raise exception 'invalid photo' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='child-care-photos' and name=object_path and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint=byte_size)
    or (select count(*) from storage.objects where bucket_id='child-care-photos' and name in (object_path||'.display-v1-480.webp',object_path||'.display-v1-1600.webp') and metadata->>'mimetype'='image/webp')<>2 then raise exception 'photo missing' using errcode='23514'; end if;
 end if;

 insert into public.child_records(id,child_id,service,kind,occurred_at,record_timezone,title,sender_name,received_amount,received_currency,created_by,updated_by)
 values(p_id,p_child,'activity',k,(p_data->>'occurred_at')::timestamptz,p_data->>'timezone',case when k='gift' then btrim(coalesce(p_data->>'title','')) else '' end,btrim(p_data->>'sender_name'),case when k='allowance' then (p_data->>'received_amount')::numeric end,case when k='allowance' then p_data->>'received_currency' end,auth.uid(),auth.uid())
 on conflict(id) do update set occurred_at=excluded.occurred_at,record_timezone=excluded.record_timezone,title=excluded.title,sender_name=excluded.sender_name,received_amount=excluded.received_amount,received_currency=excluded.received_currency,updated_by=auth.uid(),updated_at=now(),version=child_records.version+1;
 if photo is not null then
  delete from public.child_record_photos where record_id=p_id;
  insert into public.child_record_photos(id,record_id,child_id,path,content_type,size_bytes,uploaded_by,variants_ready)
   values(photo_id,p_id,p_child,object_path,'image/webp',byte_size,auth.uid(),true);
 elsif removed is not null then
  delete from public.child_record_photos where id=removed and record_id=p_id;
 end if;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),k||'_saved',p_id);
 return p_id;
end $$;

create function public.received_gift_senders(p_child uuid)
returns table(sender_name text,total_count bigint,latest_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$ begin
 if not coalesce(public.can_read_child(p_child),false) then raise exception 'forbidden' using errcode='42501'; end if;
 return query select r.sender_name,count(*),max(r.occurred_at) from public.child_records r where r.child_id=p_child and r.service='activity' and r.kind='gift' group by r.sender_name order by max(r.occurred_at) desc,r.sender_name;
end $$;
create function public.received_allowance_totals(p_child uuid)
returns table(sender_name text,currency text,total_amount text,total_count bigint,is_total boolean)
language plpgsql stable security invoker set search_path='' as $$ begin
 if not coalesce(public.can_read_child(p_child),false) then raise exception 'forbidden' using errcode='42501'; end if;
 return query select r.sender_name,r.received_currency,sum(r.received_amount)::text,count(*),grouping(r.sender_name)=1
 from public.child_records r where r.child_id=p_child and r.service='activity' and r.kind='allowance'
 group by grouping sets ((r.received_currency),(r.sender_name,r.received_currency))
 order by grouping(r.sender_name) desc,r.sender_name,r.received_currency;
end $$;
revoke all on function public.received_gift_senders(uuid),public.received_allowance_totals(uuid) from public,anon;
grant execute on function public.received_gift_senders(uuid),public.received_allowance_totals(uuid) to authenticated;
create index gift_sender_history on public.child_records(child_id,sender_name,occurred_at desc,id desc) where service='activity' and kind='gift';

commit;
