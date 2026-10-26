-- Daily care shares existing child access, audit, export and deletion rules.
alter table public.child_records
 add column temperature_c numeric,
 add column medicine_name text not null default '',
 add column dose_amount numeric,
 add column dose_unit text,
 add column duration_minutes integer;
alter table public.child_records drop constraint child_records_service_check;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.child_records'::regclass and contype='c' and pg_get_constraintdef(oid) like '%service%' and pg_get_constraintdef(oid) like '%kind%' loop
 execute format('alter table public.child_records drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.child_records add constraint child_record_service check(service in ('sleep','diaper','growth','activity'));
alter table public.child_records add constraint child_record_shape check ((service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and length(trim(title))>0 and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null) or (service='activity' and kind in ('bath','hospital','temperature','medication','snack','play','tummy') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null));
alter table public.child_records add constraint activity_fields check (
 (temperature_c is null or (service='activity' and kind='temperature' and temperature_c between 30 and 45))
 and (service<>'activity' or kind<>'temperature' or temperature_c is not null)
 and (length(medicine_name)<=200)
 and (kind='medication' or (medicine_name='' and dose_amount is null and dose_unit is null))
 and (kind<>'medication' or (length(trim(medicine_name))>0 and dose_amount>0 and dose_amount<=10000 and dose_unit in ('ml','mg','g','tablet','drop','packet') and dose_amount is not null and dose_unit is not null))
 and (duration_minutes is null or (service='activity' and kind in ('bath','play','tummy') and duration_minutes between 1 and 1440))
);

create or replace function public.save_child_record(p_id uuid,p_child uuid,p_service text,p_data jsonb,p_version integer default null)
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
 insert into public.child_records(id,child_id,service,kind,occurred_at,ended_at,height_cm,weight_kg,head_cm,stool_color,stool_texture,title,note,record_timezone,created_by,updated_by,temperature_c,medicine_name,dose_amount,dose_unit,duration_minutes)
 values(p_id,p_child,p_service,p_data->>'kind',(p_data->>'occurred_at')::timestamptz,nullif(p_data->>'ended_at','')::timestamptz,
 nullif(p_data->>'height_cm','')::numeric,nullif(p_data->>'weight_kg','')::numeric,nullif(p_data->>'head_cm','')::numeric,
 nullif(p_data->>'stool_color',''),nullif(p_data->>'stool_texture',''),coalesce(p_data->>'title',''),coalesce(p_data->>'note',''),p_data->>'timezone',auth.uid(),auth.uid(),nullif(p_data->>'temperature_c','')::numeric,coalesce(p_data->>'medicine_name',''),nullif(p_data->>'dose_amount','')::numeric,nullif(p_data->>'dose_unit',''),nullif(p_data->>'duration_minutes','')::integer)
 on conflict(id) do update set kind=excluded.kind,occurred_at=excluded.occurred_at,ended_at=excluded.ended_at,
 height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,head_cm=excluded.head_cm,stool_color=excluded.stool_color,stool_texture=excluded.stool_texture,
 temperature_c=excluded.temperature_c,medicine_name=excluded.medicine_name,dose_amount=excluded.dose_amount,dose_unit=excluded.dose_unit,duration_minutes=excluded.duration_minutes,
 title=excluded.title,note=excluded.note,record_timezone=excluded.record_timezone,updated_by=auth.uid(),updated_at=now(),version=child_records.version+1;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),p_service||'_saved',p_id);
 return p_id;
end $$;
