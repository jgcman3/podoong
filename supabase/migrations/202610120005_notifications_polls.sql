-- App inbox only: no email, push token, private text or child names in job logs.
create table public.notification_preferences (
 user_id uuid primary key references public.profiles on delete cascade,
 task_enabled boolean not null default true,event_enabled boolean not null default true,feeding_enabled boolean not null default false,
 quiet_start time not null default '22:00',quiet_end time not null default '07:00',
 delivery_hour integer not null default 9 check(delivery_hour between 0 and 23),
 frequency_minutes integer not null default 60 check(frequency_minutes between 1 and 1440),
 feeding_interval_minutes integer not null default 180 check(feeding_interval_minutes between 30 and 1440),snooze_until timestamptz
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles on delete cascade,
 child_id uuid not null references public.children on delete cascade,kind text not null check(kind in ('task','event','feeding')),
 reference_id uuid not null,reference_date date,dedupe_key text not null,scheduled_at timestamptz not null,
 delivered_at timestamptz,read_at timestamptz,cancelled_at timestamptz,unique(recipient_id,dedupe_key)
);
create index on public.notifications(recipient_id,delivered_at desc);
create table public.notification_job_runs (
 id uuid primary key default gen_random_uuid(),recipient_id uuid references public.profiles on delete cascade,
 started_at timestamptz not null default clock_timestamp(),finished_at timestamptz,status text not null default 'running' check(status in ('running','succeeded','failed')),
 attempts integer not null default 1,error_code text,delivered_count integer not null default 0
);
create index on public.notification_job_runs(started_at desc);
create function public.notification_quiet(p_start time,p_end time,p_local time) returns boolean language sql immutable set search_path='' as $$
 select case when p_start=p_end then false when p_start<p_end then p_local>=p_start and p_local<p_end else p_local>=p_start or p_local<p_end end;
$$;
create function public.notification_child_access(p_user uuid,p_child uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.children c join public.family_members m on m.family_id=c.family_id where c.id=p_child and m.user_id=p_user and (m.role='owner' or exists(select 1 from public.child_access a where a.child_id=c.id and a.user_id=p_user)));
$$;
-- This private predicate is shared by scheduler and RLS; it never trusts a browser clock.
create function public.notification_valid(p_notification public.notifications) returns boolean language sql stable security definer set search_path='' as $$
 select p_notification.cancelled_at is null and public.notification_child_access(p_notification.recipient_id,p_notification.child_id)
 and exists(select 1 from public.notification_preferences p where p.user_id=p_notification.recipient_id and case p_notification.kind
 when 'task' then p.task_enabled and exists(select 1 from public.tasks t where t.id=p_notification.reference_id and t.child_id=p_notification.child_id and t.status='todo' and t.due_date=p_notification.reference_date and (t.assignee_id is null or t.assignee_id=p_notification.recipient_id))
 when 'event' then p.event_enabled and exists(select 1 from public.events e where e.id=p_notification.reference_id and e.child_id=p_notification.child_id and e.date=p_notification.reference_date)
 else p.feeding_enabled and exists(select 1 from public.care_records r where r.id=p_notification.reference_id and r.child_id=p_notification.child_id and r.kind in ('breast','formula') and r.ended_at is not null and not exists(select 1 from public.care_records newer where newer.child_id=r.child_id and newer.kind in ('breast','formula') and (newer.started_at>r.started_at or (newer.started_at=r.started_at and newer.id>r.id))) and p_notification.scheduled_at=r.ended_at+make_interval(mins=>p.feeding_interval_minutes)) end);
$$;
create function public.notification_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.notifications n where n.id=p_id and n.recipient_id=auth.uid() and n.delivered_at is not null and public.notification_valid(n));
$$;
create function public.deliver_notifications_internal(p_user uuid) returns integer language plpgsql security definer set search_path='' as $$
declare prefs public.notification_preferences; zone text; local_now timestamp; current_clock timestamptz:=clock_timestamp(); delivered integer:=0;
begin
 select * into prefs from public.notification_preferences where user_id=p_user for update;
 if not found then return 0; end if;
 select timezone into zone from public.profiles where id=p_user and consented_at is not null;
 if not found then return 0; end if;
 local_now:=current_clock at time zone zone;
 insert into public.notifications(recipient_id,child_id,kind,reference_id,reference_date,dedupe_key,scheduled_at)
 select p_user,t.child_id,'task',t.id,t.due_date,'task:'||t.id||':'||t.due_date, (t.due_date+make_time(prefs.delivery_hour,0,0)) at time zone zone
 from public.tasks t where prefs.task_enabled and t.status='todo' and t.due_date=local_now::date and (t.assignee_id is null or t.assignee_id=p_user) and public.notification_child_access(p_user,t.child_id)
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null;
 insert into public.notifications(recipient_id,child_id,kind,reference_id,reference_date,dedupe_key,scheduled_at)
 select p_user,e.child_id,'event',e.id,e.date,'event:'||e.id||':'||e.date,(e.date+make_time(prefs.delivery_hour,0,0)) at time zone zone
 from public.events e where prefs.event_enabled and e.date=local_now::date and public.notification_child_access(p_user,e.child_id)
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null;
 insert into public.notifications(recipient_id,child_id,kind,reference_id,dedupe_key,scheduled_at)
 select p_user,r.child_id,'feeding',r.id,'feeding:'||r.id||':'||prefs.feeding_interval_minutes,r.ended_at+make_interval(mins=>prefs.feeding_interval_minutes)
 from public.care_records r where prefs.feeding_enabled and r.kind in ('breast','formula') and r.ended_at is not null and public.notification_child_access(p_user,r.child_id)
 and not exists(select 1 from public.care_records newer where newer.child_id=r.child_id and newer.kind in ('breast','formula') and (newer.started_at>r.started_at or (newer.started_at=r.started_at and newer.id>r.id)))
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null;
 update public.notifications n set cancelled_at=current_clock where recipient_id=p_user and cancelled_at is null and (not public.notification_valid(n) or (kind in ('task','event') and reference_date<>local_now::date));
 if prefs.snooze_until>current_clock or public.notification_quiet(prefs.quiet_start,prefs.quiet_end,local_now::time) then return 0; end if;
 if exists(select 1 from public.notifications where recipient_id=p_user and delivered_at>current_clock-make_interval(mins=>prefs.frequency_minutes)) then return 0; end if;
 update public.notifications n set delivered_at=current_clock where recipient_id=p_user and delivered_at is null and scheduled_at<=current_clock and public.notification_valid(n);
 get diagnostics delivered=row_count; return delivered;
end $$;
create function public.notification_run_one(p_user uuid,p_retry uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare run_id uuid; count_delivered integer;
begin
 if p_retry is null then insert into public.notification_job_runs(recipient_id) values(p_user) returning id into run_id;
 else
 update public.notification_job_runs set status='running',attempts=attempts+1,started_at=clock_timestamp(),finished_at=null,error_code=null where id=p_retry and recipient_id=p_user and status='failed' returning id into run_id;
 if not found then raise exception 'not_failed'; end if;
 end if;
 begin
 count_delivered:=public.deliver_notifications_internal(p_user);
 update public.notification_job_runs set status='succeeded',finished_at=clock_timestamp(),delivered_count=count_delivered where id=run_id;
 if count_delivered=0 and p_retry is null then delete from public.notification_job_runs where id=run_id; end if;
 exception when others then
 -- SQLSTATE only: exception text can contain personal care values.
 update public.notification_job_runs set status='failed',finished_at=clock_timestamp(),error_code=sqlstate where id=run_id;
 end;
end $$;
create function public.sync_notifications() returns void language plpgsql security definer set search_path='' as $$
begin if not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if; perform public.notification_run_one(auth.uid()); end $$;
create function public.run_notification_jobs() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not pg_try_advisory_xact_lock(723451234) then return; end if;
 for uid in select user_id from public.notification_preferences loop perform public.notification_run_one(uid); end loop;
 -- Bound successful diagnostics retention; retain failures for operator investigation/retry.
 delete from public.notification_job_runs where status='succeeded' and started_at<clock_timestamp()-interval '7 days';
end $$;
create function public.retry_notification_job(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 select recipient_id into uid from public.notification_job_runs where id=p_id and status='failed' for update;
 if not found or uid is null then raise exception 'not_failed'; end if;
 perform public.notification_run_one(uid,p_id);
end $$;
create function public.save_notification_preferences(p_task boolean,p_event boolean,p_feeding boolean,p_quiet_start time,p_quiet_end time,p_hour integer,p_frequency integer,p_interval integer,p_snooze_minutes integer default 0) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_snooze_minutes not between 0 and 1440 then raise exception 'invalid_snooze'; end if;
 insert into public.notification_preferences values(auth.uid(),p_task,p_event,p_feeding,p_quiet_start,p_quiet_end,p_hour,p_frequency,p_interval,case when p_snooze_minutes=0 then null else clock_timestamp()+make_interval(mins=>p_snooze_minutes) end)
 on conflict(user_id) do update set task_enabled=excluded.task_enabled,event_enabled=excluded.event_enabled,feeding_enabled=excluded.feeding_enabled,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,delivery_hour=excluded.delivery_hour,frequency_minutes=excluded.frequency_minutes,feeding_interval_minutes=excluded.feeding_interval_minutes,snooze_until=excluded.snooze_until;
 perform public.notification_run_one(auth.uid());
end $$;
create function public.read_notification(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin update public.notifications set read_at=clock_timestamp() where id=p_id and public.notification_visible(p_id); if not found then raise exception 'forbidden' using errcode='42501'; end if; end $$;

create table public.daily_polls (
 id uuid primary key default gen_random_uuid(),day date not null unique,
 question_ko text not null check(length(btrim(question_ko)) between 1 and 300),question_en text not null check(length(btrim(question_en)) between 1 and 300),options jsonb not null,
 opens_at timestamptz generated always as (day::timestamp at time zone 'Asia/Seoul') stored,
 closes_at timestamptz generated always as ((day+1)::timestamp at time zone 'Asia/Seoul') stored,
 hidden boolean not null default false,created_at timestamptz not null default clock_timestamp(),
 check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6)
);
create table public.daily_poll_votes(poll_id uuid references public.daily_polls on delete cascade,user_id uuid references public.profiles on delete cascade,option_index integer not null check(option_index between 0 and 5),updated_at timestamptz not null default clock_timestamp(),primary key(poll_id,user_id));
create function public.daily_poll_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.community_participant() and exists(select 1 from public.daily_polls where id=p_id and ((not hidden and opens_at<=now()) or public.is_moderator()));
$$;
create function public.save_daily_poll(p_id uuid,p_day date,p_question_ko text,p_question_en text,p_options jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb; old_poll public.daily_polls;
begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_day is null or p_day<(clock_timestamp() at time zone 'Asia/Seoul')::date or p_day>(clock_timestamp() at time zone 'Asia/Seoul')::date+365 then raise exception 'invalid_day'; end if;
 if jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options) not between 2 and 6 then raise exception 'invalid_options'; end if;
 for item in select value from jsonb_array_elements(p_options) loop
 if jsonb_typeof(item->'ko') is distinct from 'string' or jsonb_typeof(item->'en') is distinct from 'string' or length(btrim(item->>'ko')) not between 1 and 120 or length(btrim(item->>'en')) not between 1 and 120 then raise exception 'invalid_options'; end if;
 end loop;
 select * into old_poll from public.daily_polls where id=p_id for update;
 if found and clock_timestamp()>=old_poll.opens_at then raise exception 'already_open'; end if;
 insert into public.daily_polls(id,day,question_ko,question_en,options) values(p_id,p_day,btrim(p_question_ko),btrim(p_question_en),p_options)
 on conflict(id) do update set day=excluded.day,question_ko=excluded.question_ko,question_en=excluded.question_en,options=excluded.options where daily_polls.opens_at>clock_timestamp();
 if not found then raise exception 'already_open'; end if;
 insert into public.moderation_actions(moderator_id,action,subject_id,reason) values(auth.uid(),'poll-save',p_id,'Bilingual question configuration');
 return p_id;
end $$;
create function public.hide_daily_poll(p_id uuid,p_hidden boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'reason_required'; end if;
 update public.daily_polls set hidden=p_hidden where id=p_id; if not found then raise exception 'not_found'; end if;
 insert into public.moderation_actions(moderator_id,action,subject_id,reason) values(auth.uid(),case when p_hidden then 'poll-hide' else 'poll-unhide' end,p_id,p_reason);
end $$;
create function public.vote_daily_poll(p_id uuid,p_option integer) returns void language plpgsql security definer set search_path='' as $$
declare poll public.daily_polls;
begin
 if not public.community_can_write() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into poll from public.daily_polls where id=p_id for update;
 if not found or poll.hidden or clock_timestamp()<poll.opens_at or clock_timestamp()>=poll.closes_at then raise exception 'poll_closed'; end if;
 if p_option is null or p_option<0 or p_option>=jsonb_array_length(poll.options) then raise exception 'invalid_option'; end if;
 insert into public.daily_poll_votes values(p_id,auth.uid(),p_option,clock_timestamp()) on conflict(poll_id,user_id) do update set option_index=excluded.option_index,updated_at=excluded.updated_at;
end $$;
create function public.poll_results(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.daily_poll_visible(p_id) then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object('total',count(*),'counts',coalesce((select jsonb_object_agg(option_index,amount) from (select option_index,count(*) amount from public.daily_poll_votes where poll_id=p_id group by option_index) c),'{}'::jsonb)) into result from public.daily_poll_votes where poll_id=p_id;
 return result;
end $$;

do $$ declare t text; begin foreach t in array array['notification_preferences','notifications','notification_job_runs','daily_polls','daily_poll_votes'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); execute format('grant select on public.%I to authenticated',t); end loop; end $$;
create policy own_preferences on public.notification_preferences for select to authenticated using(user_id=auth.uid());
create policy own_notifications on public.notifications for select to authenticated using(public.notification_visible(id));
create policy operator_jobs on public.notification_job_runs for select to authenticated using(public.is_moderator());
create policy visible_polls on public.daily_polls for select to authenticated using(public.daily_poll_visible(id));
create policy own_votes on public.daily_poll_votes for select to authenticated using(user_id=auth.uid() and public.daily_poll_visible(poll_id));
-- Default PUBLIC execute grants must be removed, especially for internal scheduling predicates.
revoke all on function public.notification_quiet(time,time,time),public.notification_child_access(uuid,uuid),public.notification_valid(public.notifications),public.deliver_notifications_internal(uuid),public.notification_run_one(uuid,uuid),public.run_notification_jobs() from public,anon,authenticated;
grant execute on function public.run_notification_jobs() to service_role;
revoke all on function public.notification_visible(uuid),public.sync_notifications(),public.retry_notification_job(uuid),public.save_notification_preferences(boolean,boolean,boolean,time,time,integer,integer,integer,integer),public.read_notification(uuid),public.daily_poll_visible(uuid),public.save_daily_poll(uuid,date,text,text,jsonb),public.hide_daily_poll(uuid,boolean,text),public.vote_daily_poll(uuid,integer),public.poll_results(uuid) from public,anon;
grant execute on function public.notification_visible(uuid),public.sync_notifications(),public.retry_notification_job(uuid),public.save_notification_preferences(boolean,boolean,boolean,time,time,integer,integer,integer,integer),public.read_notification(uuid),public.daily_poll_visible(uuid),public.save_daily_poll(uuid,date,text,text,jsonb),public.hide_daily_poll(uuid,boolean,text),public.vote_daily_poll(uuid,integer),public.poll_results(uuid) to authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('podung-inbox-minute','* * * * *','select public.run_notification_jobs()');
