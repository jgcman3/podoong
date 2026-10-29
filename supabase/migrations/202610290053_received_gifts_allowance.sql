begin;
alter table public.child_records
 add column sender_name text,
 add column received_amount numeric,
 add column received_currency text;
alter table public.child_records drop constraint child_record_shape;
alter table public.child_records add constraint child_record_shape check (
 (service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry','diaper_dirty','diaper_mixed') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed','diaper_dirty','diaper_mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='activity' and kind in ('bath','hospital','temperature','medication','snack','play','tummy','daycare','kindergarten','gift','allowance') and (ended_at is null or kind in ('daycare','kindergarten')) and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
);
alter table public.child_records add constraint received_record_fields check (
 (service='activity' and kind='gift' and sender_name is not null and length(btrim(sender_name)) between 1 and 100 and length(btrim(title))>0 and received_amount is null and received_currency is null)
 or (service='activity' and kind='allowance' and sender_name is not null and length(btrim(sender_name)) between 1 and 100 and received_amount is not null and received_amount>0 and received_amount<=999999999999.99 and received_amount=round(received_amount,2) and received_currency is not null and received_currency ~ '^[A-Z]{3}$')
 or (kind not in ('gift','allowance') and sender_name is null and received_amount is null and received_currency is null)
);
create index child_received_history on public.child_records(child_id,kind,occurred_at desc,id desc) where service='activity' and kind in ('gift','allowance');

create function public.save_received_record(p_id uuid,p_child uuid,p_data jsonb,p_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.child_records; fid uuid; k text := p_data->>'kind';
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
 insert into public.child_records(id,child_id,service,kind,occurred_at,record_timezone,title,sender_name,received_amount,received_currency,created_by,updated_by)
 values(p_id,p_child,'activity',k,(p_data->>'occurred_at')::timestamptz,p_data->>'timezone',case when k='gift' then btrim(coalesce(p_data->>'title','')) else '' end,btrim(p_data->>'sender_name'),case when k='allowance' then (p_data->>'received_amount')::numeric end,case when k='allowance' then p_data->>'received_currency' end,auth.uid(),auth.uid())
 on conflict(id) do update set occurred_at=excluded.occurred_at,record_timezone=excluded.record_timezone,title=excluded.title,sender_name=excluded.sender_name,received_amount=excluded.received_amount,received_currency=excluded.received_currency,updated_by=auth.uid(),updated_at=now(),version=child_records.version+1;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),k||'_saved',p_id);
 return p_id;
end $$;
revoke all on function public.save_received_record(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_received_record(uuid,uuid,jsonb,integer) to authenticated;
commit;
