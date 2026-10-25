create table public.vaccination_records (
 id uuid primary key, child_id uuid not null references public.children on delete cascade,
 vaccine text not null check(vaccine in ('bcg','hepb','dtap','polio','hib','pcv','rotavirus','mmr','varicella','hepa','je','hpv','influenza','other')),
 custom_name text not null default '' check(length(custom_name)<=120),
 dose integer check(dose between 1 and 10),
 season text check(season ~ '^[0-9]{4}-[0-9]{4}$' and substring(season,6,4)::int=substring(season,1,4)::int+1),
 status text not null check(status in ('planned','completed')),
 scheduled_date date, completed_date date,
 clinic text not null default '' check(length(clinic)<=200), note text not null default '' check(length(note)<=2000),
 record_timezone text not null,
 created_by uuid references public.profiles on delete set null, updated_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(vaccine<>'other' or length(trim(custom_name))>0),
 check(vaccine='influenza' or season is null),
 check((status='planned' and scheduled_date is not null and completed_date is null) or (status='completed' and completed_date is not null))
);
create index vaccination_child_date on public.vaccination_records(child_id,status,scheduled_date,completed_date,id);
alter table public.vaccination_records enable row level security;
revoke all on public.vaccination_records from anon,authenticated;
grant select on public.vaccination_records to authenticated;
create policy vaccination_read on public.vaccination_records for select to authenticated using(public.can_read_child(child_id));
create function public.save_vaccination_record(p_id uuid,p_child uuid,p_data jsonb,p_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare old public.vaccination_records; fid uuid; tz text:=p_data->>'timezone';
begin
 if not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'invalid timezone' using errcode='22023'; end if;
 if nullif(p_data->>'completed_date','')::date>(now() at time zone tz)::date then raise exception 'future completion' using errcode='22023'; end if;
 perform 1 from public.children where id=p_child for update;
 select * into old from public.vaccination_records where id=p_id for update;
 if old.id is not null then
  if old.child_id<>p_child then raise exception 'forbidden' using errcode='42501'; end if;
  if p_version is null then
   if old.created_by=auth.uid() then return p_id; end if;
   raise exception 'conflict';
  end if;
  if old.version<>p_version then raise exception 'conflict'; end if;
 elsif p_version is not null then raise exception 'conflict'; end if;
 insert into public.vaccination_records(id,child_id,vaccine,custom_name,dose,season,status,scheduled_date,completed_date,clinic,note,record_timezone,created_by,updated_by)
 values(p_id,p_child,p_data->>'vaccine',case when p_data->>'vaccine'='other' then coalesce(p_data->>'custom_name','') else '' end,
 nullif(p_data->>'dose','')::int,case when p_data->>'vaccine'='influenza' then nullif(p_data->>'season','') else null end,
 p_data->>'status',nullif(p_data->>'scheduled_date','')::date,case when p_data->>'status'='completed' then nullif(p_data->>'completed_date','')::date else null end,
 coalesce(p_data->>'clinic',''),coalesce(p_data->>'note',''),tz,auth.uid(),auth.uid())
 on conflict(id) do update set vaccine=excluded.vaccine,custom_name=excluded.custom_name,dose=excluded.dose,season=excluded.season,status=excluded.status,
 scheduled_date=excluded.scheduled_date,completed_date=excluded.completed_date,clinic=excluded.clinic,note=excluded.note,record_timezone=excluded.record_timezone,
 updated_by=auth.uid(),updated_at=now(),version=vaccination_records.version+1;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'vaccination_saved',p_id);
 return p_id;
end $$;
create function public.delete_vaccination_record(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.vaccination_records; fid uuid; begin
 select * into r from public.vaccination_records where id=p_id for update;
 if r.id is null or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into fid from public.children where id=r.child_id;
 delete from public.vaccination_records where id=p_id;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'vaccination_deleted',p_id);
end $$;
revoke all on function public.save_vaccination_record(uuid,uuid,jsonb,integer),public.delete_vaccination_record(uuid) from public,anon;
grant execute on function public.save_vaccination_record(uuid,uuid,jsonb,integer),public.delete_vaccination_record(uuid) to authenticated;
create or replace function public.export_child_data(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('format_version',3,'exported_at',now(),'timestamps','UTC ISO-8601',
 'child',(select to_jsonb(c)-'family_id' from public.children c where id=p_child),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by started_at,id) from public.care_records r where child_id=p_child),'[]'::jsonb),
 'child_records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by occurred_at,id) from public.child_records r where child_id=p_child),'[]'::jsonb),
 'child_photos',coalesce((select jsonb_agg(to_jsonb(p)-'uploaded_by'-'path' order by created_at,id) from public.child_record_photos p where child_id=p_child),'[]'::jsonb),
 'vaccinations',coalesce((select jsonb_agg(to_jsonb(v)-'created_by'-'updated_by' order by coalesce(completed_date,scheduled_date),id) from public.vaccination_records v where child_id=p_child),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'created_by'-'assignee_id' order by due_date,id) from public.tasks t where child_id=p_child),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)-'created_by' order by date,id) from public.events e where child_id=p_child),'[]'::jsonb));
end $$;
