-- Planned hospital/medication events and one permission-preserving schedule projection.
alter table public.events
 add column event_kind text not null default 'general' check(event_kind in ('general','hospital','medication')),
 add column event_time time,
 add column record_timezone text,
 add constraint event_clock_timezone check(event_time is null or record_timezone is not null);

create function public.save_calendar_event(p_id uuid,p_child_id uuid,p_title text,p_date date,p_note text,p_event_kind text default 'general',p_event_time text default '',p_event_timezone text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare fid uuid;
begin
 if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_event_kind not in ('general','hospital','medication') or p_event_kind is null then raise exception 'invalid event kind' using errcode='22023'; end if;
 if p_event_timezone<>'' and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_event_timezone) then raise exception 'invalid timezone' using errcode='22023'; end if;
 if coalesce(p_event_time,'')<>'' and coalesce(p_event_timezone,'')='' then raise exception 'timezone required' using errcode='22023'; end if;
 if exists(select 1 from public.events where id=p_id and child_id<>p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 insert into public.events(id,child_id,title,date,note,event_kind,event_time,record_timezone,created_by)
 values(p_id,p_child_id,p_title,p_date,p_note,p_event_kind,nullif(p_event_time,'')::time,nullif(p_event_timezone,''),auth.uid())
 on conflict(id) do update set title=excluded.title,date=excluded.date,note=excluded.note,event_kind=excluded.event_kind,event_time=excluded.event_time,record_timezone=excluded.record_timezone,updated_at=now()
 where public.events.child_id=excluded.child_id;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into fid from public.children where id=p_child_id;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'event_saved',p_id);
 return p_id;
end $$;
revoke all on function public.save_calendar_event(uuid,uuid,text,date,text,text,text,text) from public,anon;
grant execute on function public.save_calendar_event(uuid,uuid,text,date,text,text,text,text) to authenticated;

-- Keep existing callers compatible without erasing new event metadata on edits.
create or replace function public.save_event(p_id uuid,p_child_id uuid,p_title text,p_date date,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.events;
begin
 select * into r from public.events where id=p_id;
 return public.save_calendar_event(p_id,p_child_id,p_title,p_date,p_note,coalesce(r.event_kind,'general'),coalesce(r.event_time::text,''),coalesce(r.record_timezone,''));
end $$;

create view public.calendar_entries with (security_invoker=true) as
 select id,child_id,title,date,note,event_kind,event_time,record_timezone,
 'event'::text as source,'planned'::text as status,null::text as vaccine,null::text as custom_name,null::text as clinic
 from public.events
 union all
 select id,child_id,coalesce(nullif(custom_name,''),vaccine) as title,
 case when status='completed' then completed_date else scheduled_date end as date,
 note,'vaccination'::text as event_kind,null::time as event_time,record_timezone,
 'vaccination'::text as source,status,vaccine,custom_name,clinic
 from public.vaccination_records;
revoke all on public.calendar_entries from public,anon;
grant select on public.calendar_entries to authenticated;
