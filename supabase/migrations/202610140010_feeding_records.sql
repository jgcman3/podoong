-- Preserve existing milk/pumping records; add actual solids/meals and bottle-fed breast milk.
alter table public.care_records drop constraint care_records_kind_check;
alter table public.care_records add constraint care_records_kind_check
  check(kind in ('breast','formula','pump','expressed','solids','meal'));
alter table public.care_records add column amount_g numeric check(amount_g between 0 and 3000);
alter table public.care_records add column food_name text not null default '' check(length(food_name)<=200);
-- Existing timezone is unknown: do not fabricate a historical timezone.
alter table public.care_records add column record_timezone text;
alter table public.care_records add constraint care_record_amount_units check (
  (kind in ('solids','meal') and amount_ml is null)
  or (kind not in ('solids','meal') and amount_g is null)
);
create function public.save_feeding_record(p_id uuid,p_child_id uuid,p_kind text,p_started_at timestamptz,p_ended_at timestamptz,p_amount_ml numeric,p_amount_g numeric,p_food_name text,p_timezone text,p_note text,p_version integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.care_records; fid uuid;
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid_timezone'; end if;
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into existing from public.care_records where id=p_id for update;
  if existing.id is not null then
    if existing.child_id<>p_child_id then raise exception 'forbidden' using errcode='42501'; end if;
    if p_version is null then
      if existing.created_by=auth.uid() then return p_id; end if;
      raise exception 'conflict';
    end if;
    if existing.version<>p_version then raise exception 'conflict'; end if;
    update public.care_records set kind=p_kind,started_at=p_started_at,ended_at=p_ended_at,amount_ml=p_amount_ml,amount_g=p_amount_g,food_name=p_food_name,record_timezone=p_timezone,note=p_note,
      updated_by=auth.uid(),updated_at=now(),version=version+1 where id=p_id;
  else
    if p_version is not null then raise exception 'conflict'; end if;
    insert into public.care_records(id,child_id,kind,started_at,ended_at,amount_ml,amount_g,food_name,record_timezone,note,created_by,updated_by)
      values(p_id,p_child_id,p_kind,p_started_at,p_ended_at,p_amount_ml,p_amount_g,p_food_name,p_timezone,p_note,auth.uid(),auth.uid())
      on conflict(id) do nothing;
    -- A raced retry is valid only for the same authorized child and author.
    if not exists(select 1 from public.care_records where id=p_id and child_id=p_child_id and created_by=auth.uid()) then raise exception 'conflict'; end if;
  end if;
  select family_id into fid from public.children where id=p_child_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'care_saved',p_id);
  return p_id;
end $$;

revoke all on function public.save_feeding_record(uuid,uuid,text,timestamptz,timestamptz,numeric,numeric,text,text,text,integer) from public,anon;
grant execute on function public.save_feeding_record(uuid,uuid,text,timestamptz,timestamptz,numeric,numeric,text,text,text,integer) to authenticated;

-- Keep milk-feeding reminders consistent with bottle-fed breast milk.
do $$ declare fn regprocedure; definition text; begin
  for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
    and proname in ('notification_valid','deliver_notifications_internal') loop
    definition := pg_get_functiondef(fn);
    execute replace(definition, '(''breast'',''formula'')', '(''breast'',''formula'',''expressed'')');
  end loop;
end $$;
