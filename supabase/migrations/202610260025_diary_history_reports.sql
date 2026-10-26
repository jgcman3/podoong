alter table public.growth_diary_shares add column hidden boolean not null default false;
alter table public.community_reports
 add column diary_record_id uuid references public.child_records on delete cascade,
 add column diary_note text,
 add column diary_nickname text;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.community_reports'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%post_id%' and pg_get_constraintdef(oid) like '%comment_id%' loop
 execute format('alter table public.community_reports drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.community_reports add constraint report_single_subject check(num_nonnulls(post_id,comment_id,diary_record_id)=1);
create unique index one_open_diary_report on public.community_reports(reporter_id,diary_record_id) where status='open' and diary_record_id is not null;

create function public.growth_diary_cohort_visible(p_child uuid,p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and public.community_participant() and public.can_read_child(p_child) and exists(
 select 1 from public.child_records r join public.children c on c.id=r.child_id
 join public.children viewer on viewer.id=p_child and viewer.birth_date=c.birth_date
 join public.growth_diary_shares s on s.record_id=r.id
 where r.id=p_record and r.service='growth' and s.same_birth_date and not s.hidden
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by));
$$;
create function public.growth_diary_history(p_child uuid,p_record uuid,p_page integer default 0)
returns table(id uuid,age_days integer,weight_kg numeric,height_cm numeric,head_cm numeric)
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if not public.growth_diary_cohort_visible(p_child,p_record) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'invalid page' using errcode='22023'; end if;
 select child_id into target from public.child_records where child_records.id=p_record;
 return query select r.id,(r.occurred_at at time zone r.record_timezone)::date-c.birth_date,r.weight_kg,r.height_cm,r.head_cm
 from public.child_records r join public.children c on c.id=r.child_id
 where r.child_id=target and public.growth_diary_cohort_visible(p_child,r.id)
 and (r.weight_kg is not null or r.height_cm is not null or r.head_cm is not null)
 order by (r.occurred_at at time zone r.record_timezone)::date-c.birth_date,r.occurred_at,r.id
 limit 101 offset p_page*100;
end $$;
create function public.report_growth_diary(p_child uuid,p_record uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.growth_diary_cohort_visible(p_child,p_record) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reason' using errcode='22023'; end if;
 insert into public.community_reports(reporter_id,diary_record_id,reason,diary_note,diary_nickname)
 select auth.uid(),r.id,trim(p_reason),r.note,c.name from public.child_records r join public.children c on c.id=r.child_id where r.id=p_record
 on conflict(reporter_id,diary_record_id) where status='open' and diary_record_id is not null do nothing;
end $$;
create function public.moderate_growth_diary(p_record uuid,p_hidden boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_active() or not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_hidden is null or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reason' using errcode='22023'; end if;
 update public.growth_diary_shares set hidden=p_hidden where record_id=p_record;
 if not found then raise exception 'not found'; end if;
 insert into public.moderation_actions(moderator_id,action,subject_id,reason)
 values(auth.uid(),case when p_hidden then 'diary_hide' else 'diary_unhide' end,p_record,trim(p_reason));
end $$;
revoke all on function public.growth_diary_cohort_visible(uuid,uuid),public.growth_diary_history(uuid,uuid,integer),public.report_growth_diary(uuid,uuid,text),public.moderate_growth_diary(uuid,boolean,text) from public,anon;
grant execute on function public.growth_diary_cohort_visible(uuid,uuid),public.growth_diary_history(uuid,uuid,integer),public.report_growth_diary(uuid,uuid,text),public.moderate_growth_diary(uuid,boolean,text) to authenticated;

create or replace function public.growth_diary_feed(p_child uuid,p_scope text,p_page integer default 0,p_age integer default null)
returns table(id uuid,nickname text,age_days integer,sex text,note text,weight_kg numeric,height_cm numeric,head_cm numeric,photo_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
declare birthday date;
begin
 if not public.account_active() or not public.community_participant() or not public.can_read_child(p_child) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_scope not in ('birth','all') or p_scope is null or p_page is null or p_page<0 or p_page>10000 or p_age<0 then
  raise exception 'invalid feed' using errcode='22023';
 end if;
 select birth_date into birthday from public.children where children.id=p_child;
 return query select r.id,c.name,
 (r.occurred_at at time zone r.record_timezone)::date-c.birth_date,c.sex,r.note,
 case when p_scope='birth' then r.weight_kg end,
 case when p_scope='birth' then r.height_cm end,
 case when p_scope='birth' then r.head_cm end,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.created_at,p.id)
 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where not s.hidden and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and ((p_scope='birth' and s.same_birth_date and c.birth_date=birthday) or (p_scope='all' and s.everyone))
 and (p_scope='all' or p_age is null or (r.occurred_at at time zone r.record_timezone)::date-c.birth_date=p_age)
 order by r.occurred_at desc,r.id limit 21 offset p_page*20;
end $$;

create or replace function public.growth_diary_photo_allowed(p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and public.community_participant() and exists(
 select 1 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where not s.hidden and s.record_id=p_record and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and (s.everyone or (s.same_birth_date and exists(
 select 1 from public.children viewer where viewer.birth_date=c.birth_date and public.can_read_child(viewer.id)))));
$$;
