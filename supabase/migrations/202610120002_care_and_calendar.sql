create table public.care_records (
  id uuid primary key,
  child_id uuid not null references public.children on delete cascade,
  kind text not null check(kind in ('breast','formula','pump')),
  started_at timestamptz not null,
  ended_at timestamptz,
  amount_ml numeric check(amount_ml between 0 and 3000),
  note text not null default '' check(length(note)<=2000),
  created_by uuid not null references public.profiles,
  updated_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check(ended_at is null or ended_at>=started_at)
);
create unique index one_active_timer on public.care_records(child_id,created_by) where ended_at is null;
create index care_recent on public.care_records(child_id,started_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  title text not null check(length(title) between 1 and 200),
  service text not null,
  status text not null default 'todo' check(status in ('todo','done','snoozed')),
  due_date date,
  assignee_id uuid references public.profiles on delete set null,
  source text not null default 'manual' check(source in ('manual','recommended')),
  anchor text check(anchor in ('due','birth','lifecycle')),
  offset_days integer,
  template_key text,
  created_by uuid not null references public.profiles,
  updated_at timestamptz not null default now(),
  unique(child_id,template_key),
  check(source='manual' or (anchor is not null and offset_days is not null))
);
create index tasks_due on public.tasks(child_id,status,due_date);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  title text not null check(length(title) between 1 and 200),
  date date not null,
  note text not null default '' check(length(note)<=2000),
  created_by uuid not null references public.profiles,
  updated_at timestamptz not null default now()
);
create index events_date on public.events(child_id,date);

create table public.content_items (
  key text primary key,
  service text not null,
  country text not null default 'KR', region text not null default 'KR',
  source_url text, effective_date date, last_reviewed_at date, reviewer text,
  status text not null default 'draft' check(status in ('draft','published','archived'))
);
create table public.content_translations (
  content_key text not null references public.content_items on delete cascade,
  locale text not null check(locale in ('ko','en')),
  title text not null, body text not null,
  primary key(content_key,locale)
);

-- All mutations pass through RPCs so authors, audit history, and date rules cannot be bypassed.
create function public.save_care_record(p_id uuid,p_child_id uuid,p_kind text,p_started_at timestamptz,p_ended_at timestamptz,p_amount_ml numeric,p_note text,p_version integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.care_records; fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into existing from public.care_records where id=p_id for update;
  if existing.id is not null then
    if existing.child_id<>p_child_id then raise exception 'forbidden' using errcode='42501'; end if;
    if p_version is null then
      if existing.created_by=auth.uid() then return p_id; end if;
      raise exception 'conflict';
    end if;
    if existing.version<>p_version then raise exception 'conflict'; end if;
    update public.care_records set kind=p_kind,started_at=p_started_at,ended_at=p_ended_at,amount_ml=p_amount_ml,note=p_note,
      updated_by=auth.uid(),updated_at=now(),version=version+1 where id=p_id;
  else
    if p_version is not null then raise exception 'conflict'; end if;
    insert into public.care_records(id,child_id,kind,started_at,ended_at,amount_ml,note,created_by,updated_by)
      values(p_id,p_child_id,p_kind,p_started_at,p_ended_at,p_amount_ml,p_note,auth.uid(),auth.uid())
      on conflict(id) do nothing;
    -- A raced retry is valid only for the same authorized child and author.
    if not exists(select 1 from public.care_records where id=p_id and child_id=p_child_id and created_by=auth.uid()) then raise exception 'conflict'; end if;
  end if;
  select family_id into fid from public.children where id=p_child_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'care_saved',p_id);
  return p_id;
end $$;

create function public.delete_care_record(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; fid uuid;
begin
  select child_id into cid from public.care_records where id=p_id;
  if not public.can_write_child(cid) then raise exception 'forbidden' using errcode='42501'; end if;
  select family_id into fid from public.children where id=cid;
  delete from public.care_records where id=p_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'care_deleted',p_id);
end $$;

create function public.save_task(p_id uuid,p_child_id uuid,p_title text,p_service text,p_due_date date,p_status text,p_assignee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_assignee_id is not null and not exists(select 1 from public.family_members m join public.children c on c.family_id=m.family_id
    where c.id=p_child_id and m.user_id=p_assignee_id and (m.role='owner' or exists(select 1 from public.child_access a where a.child_id=p_child_id and a.user_id=p_assignee_id))) then raise exception 'invalid_assignee'; end if;
  if exists(select 1 from public.tasks where id=p_id and child_id<>p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.tasks(id,child_id,title,service,due_date,status,assignee_id,created_by)
    values(p_id,p_child_id,p_title,p_service,p_due_date,p_status,p_assignee_id,auth.uid())
    on conflict(id) do update set title=excluded.title,service=excluded.service,due_date=excluded.due_date,status=excluded.status,assignee_id=excluded.assignee_id,updated_at=now();
  select family_id into fid from public.children where id=p_child_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'task_saved',p_id);
  return p_id;
end $$;
create function public.save_event(p_id uuid,p_child_id uuid,p_title text,p_date date,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if exists(select 1 from public.events where id=p_id and child_id<>p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.events(id,child_id,title,date,note,created_by) values(p_id,p_child_id,p_title,p_date,p_note,auth.uid())
    on conflict(id) do update set title=excluded.title,date=excluded.date,note=excluded.note,updated_at=now() where public.events.child_id=excluded.child_id;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select family_id into fid from public.children where id=p_child_id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'event_saved',p_id);
  return p_id;
end $$;
create function public.delete_calendar_item(p_id uuid,p_kind text) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; fid uuid;
begin
  if p_kind='event' then select child_id into cid from public.events where id=p_id;
  elsif p_kind='task' then select child_id into cid from public.tasks where id=p_id;
  else raise exception 'invalid_kind'; end if;
  if not public.can_write_child(cid) then raise exception 'forbidden' using errcode='42501'; end if;
  select family_id into fid from public.children where id=cid;
  if p_kind='event' then delete from public.events where id=p_id; else delete from public.tasks where id=p_id; end if;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),p_kind||'_deleted',p_id);
end $$;

create function public.preview_child_dates(p_child_id uuid,p_due_date date,p_birth_date date)
returns table(task_id uuid,title text,current_due_date date,proposed_date date) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_due_date is null and p_birth_date is null then raise exception 'date_required'; end if;
  return query select t.id,t.title,t.due_date,
    case t.anchor when 'due' then p_due_date when 'birth' then p_birth_date else coalesce(p_birth_date,p_due_date) end + t.offset_days
    from public.tasks t where t.child_id=p_child_id and t.source='recommended' and t.status='todo';
end $$;
create function public.update_child_dates(p_child_id uuid,p_due_date date,p_birth_date date) returns void language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_due_date is null and p_birth_date is null then raise exception 'date_required'; end if;
  perform 1 from public.children where id=p_child_id for update;
  update public.tasks t set due_date=v.proposed_date,updated_at=now()
    from public.preview_child_dates(p_child_id,p_due_date,p_birth_date) v where t.id=v.task_id and t.source='recommended' and t.status='todo' and t.due_date is not distinct from v.current_due_date;
  update public.children set due_date=p_due_date,birth_date=p_birth_date where id=p_child_id returning family_id into fid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'child_dates_updated',p_child_id);
end $$;

create function public.add_preparation_tasks(p_child_id uuid,p_locale text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_write_child(p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_locale not in ('ko','en') then raise exception 'invalid_locale'; end if;
  insert into public.tasks(child_id,title,service,due_date,source,anchor,offset_days,template_key,created_by)
    select c.id,case when p_locale='ko' then v.ko else v.en end,v.service,
      coalesce(c.birth_date,c.due_date)+v.offset_days,'recommended','lifecycle',v.offset_days,v.key,auth.uid()
    from public.children c cross join (values
      ('bag','출산 가방 목록 확인','Review your hospital bag checklist','birth',-28),
      ('roles','가족 돌봄 역할 상의','Discuss family care roles','postpartum',-14),
      ('admin','출생 후 행정 공식 안내 확인','Check official birth registration guidance','administration',1)
    ) v(key,ko,en,service,offset_days) where c.id=p_child_id on conflict(child_id,template_key) do nothing;
end $$;

alter table public.care_records enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.content_items enable row level security;
alter table public.content_translations enable row level security;
revoke all on public.care_records,public.tasks,public.events,public.content_items,public.content_translations from anon,authenticated;
grant select on public.care_records,public.tasks,public.events to authenticated;
grant select on public.content_items,public.content_translations to anon,authenticated;
create policy care_read on public.care_records for select to authenticated using(public.can_read_child(child_id));
create policy task_read on public.tasks for select to authenticated using(public.can_read_child(child_id));
create policy event_read on public.events for select to authenticated using(public.can_read_child(child_id));
create policy content_read on public.content_items for select to anon,authenticated using(status='published');
create policy translation_read on public.content_translations for select to anon,authenticated using(exists(select 1 from public.content_items i where i.key=content_key and i.status='published'));
revoke execute on function public.save_care_record(uuid,uuid,text,timestamptz,timestamptz,numeric,text,integer),public.delete_care_record(uuid),
  public.save_task(uuid,uuid,text,text,date,text,uuid),public.save_event(uuid,uuid,text,date,text),public.delete_calendar_item(uuid,text),
  public.preview_child_dates(uuid,date,date),public.update_child_dates(uuid,date,date),public.add_preparation_tasks(uuid,text) from public,anon;
grant execute on function public.save_care_record(uuid,uuid,text,timestamptz,timestamptz,numeric,text,integer),public.delete_care_record(uuid),
  public.save_task(uuid,uuid,text,text,date,text,uuid),public.save_event(uuid,uuid,text,date,text),public.delete_calendar_item(uuid,text),
  public.preview_child_dates(uuid,date,date),public.update_child_dates(uuid,date,date),public.add_preparation_tasks(uuid,text) to authenticated;
