-- Avoid rewriting unchanged pending reminders on every scheduled run.
create or replace function public.deliver_notifications_internal(p_user uuid) returns integer language plpgsql security definer set search_path='' as $$
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
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null and (notifications.scheduled_at is distinct from excluded.scheduled_at or notifications.cancelled_at is not null);
 insert into public.notifications(recipient_id,child_id,kind,reference_id,reference_date,dedupe_key,scheduled_at)
 select p_user,e.child_id,'event',e.id,e.date,'event:'||e.id||':'||e.date,(e.date+make_time(prefs.delivery_hour,0,0)) at time zone zone
 from public.events e where prefs.event_enabled and e.date=local_now::date and public.notification_child_access(p_user,e.child_id)
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null and (notifications.scheduled_at is distinct from excluded.scheduled_at or notifications.cancelled_at is not null);
 insert into public.notifications(recipient_id,child_id,kind,reference_id,dedupe_key,scheduled_at)
 select p_user,r.child_id,'feeding',r.id,'feeding:'||r.id||':'||prefs.feeding_interval_minutes,r.ended_at+make_interval(mins=>prefs.feeding_interval_minutes)
 from public.care_records r where prefs.feeding_enabled and r.kind in ('breast','formula') and r.ended_at is not null and public.notification_child_access(p_user,r.child_id)
 and not exists(select 1 from public.care_records newer where newer.child_id=r.child_id and newer.kind in ('breast','formula') and (newer.started_at>r.started_at or (newer.started_at=r.started_at and newer.id>r.id)))
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null and (notifications.scheduled_at is distinct from excluded.scheduled_at or notifications.cancelled_at is not null);
 update public.notifications n set cancelled_at=current_clock where recipient_id=p_user and cancelled_at is null and (not public.notification_valid(n) or (kind in ('task','event') and reference_date<>local_now::date));
 if prefs.snooze_until>current_clock or public.notification_quiet(prefs.quiet_start,prefs.quiet_end,local_now::time) then return 0; end if;
 if exists(select 1 from public.notifications where recipient_id=p_user and delivered_at>current_clock-make_interval(mins=>prefs.frequency_minutes)) then return 0; end if;
 update public.notifications n set delivered_at=current_clock where recipient_id=p_user and delivered_at is null and scheduled_at<=current_clock and public.notification_valid(n);
 get diagnostics delivered=row_count; return delivered;
end $$;
