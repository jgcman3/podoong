begin;
alter table public.notification_preferences
 alter column feeding_enabled set default true,
 add column schedule_enabled boolean not null default false,
 add column schedule_enabled_at timestamptz;
drop function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text);
create function public.save_push_settings(p_mode text,p_interval integer,p_quiet boolean,p_playground boolean,p_playground_quiet boolean,p_subscription jsonb default null,p_locale text default 'ko',p_schedule boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if p_playground is null or p_playground_quiet is null or p_schedule is null or p_locale is null or p_locale not in ('ko','en') then raise exception 'invalid preferences' using errcode='22023'; end if;
 perform public.save_feeding_reminder(p_mode,p_interval,p_quiet,null,p_locale);
 update public.notification_preferences set playground_enabled=p_playground,playground_quiet=p_playground_quiet,
 playground_enabled_at=case when p_playground and not playground_enabled then now() else playground_enabled_at end,
 schedule_enabled=p_schedule,schedule_enabled_at=case when p_schedule and not schedule_enabled then now() else schedule_enabled_at end where user_id=auth.uid();
 if p_subscription is not null then
  if p_mode='off' and not p_playground and not p_schedule then raise exception 'disabled mode' using errcode='22023'; end if;
  device:=public.register_feeding_push(p_subscription->>'endpoint',p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth',p_locale);
 end if;
 return device;
end $$;
revoke all on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text,boolean) from public,anon;
grant execute on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text,boolean) to authenticated;

create function public.schedule_items(p_user uuid,p_day date)
returns table(id uuid,child_id uuid,title text,event_time time,kind text)
language sql stable security definer set search_path='' as $$
 select e.id,e.child_id,e.title,e.event_time,'event'::text from public.events e
 join public.children c on c.id=e.child_id join public.families f on f.id=c.family_id and f.merged_into is null
 where e.date=p_day and public.notification_child_access(p_user,e.child_id) and public.child_privacy_allowed(e.child_id,'child')
 and (e.event_kind not in ('hospital','medication') or public.child_privacy_allowed(e.child_id,'health'))
 union all
 select v.id,v.child_id,coalesce(nullif(v.custom_name,''),v.vaccine),null::time,'vaccination'::text from public.vaccination_records v
 join public.children c on c.id=v.child_id join public.families f on f.id=c.family_id and f.merged_into is null
 where v.status='scheduled' and v.scheduled_date=p_day and public.notification_child_access(p_user,v.child_id) and public.child_privacy_allowed(v.child_id,'health')
 union all
 select t.id,t.child_id,t.title,null::time,'task'::text from public.tasks t
 join public.children c on c.id=t.child_id join public.families f on f.id=c.family_id and f.merged_into is null
 where t.due_date=p_day and t.status='todo' and (t.assignee_id is null or t.assignee_id=p_user)
 and public.notification_child_access(p_user,t.child_id) and public.child_privacy_allowed(t.child_id,'child');
$$;
revoke all on function public.schedule_items(uuid,date) from public,anon,authenticated;
create function public.my_schedule_items(p_day date)
returns table(id uuid,child_id uuid,title text,event_time time,kind text)
language sql stable security definer set search_path='' as $$
 select * from public.schedule_items(auth.uid(),p_day) where public.account_active() and public.guardian_declared(auth.uid());
$$;
revoke all on function public.my_schedule_items(date) from public,anon;
grant execute on function public.my_schedule_items(date) to authenticated;

create table public.schedule_push_deliveries(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.web_push_subscriptions on delete cascade,
 day date not null,scheduled_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed')),
 attempts integer not null default 0,lease_token uuid,leased_until timestamptz,sent_at timestamptz,
 unique(subscription_id,day)
);
create index schedule_push_due on public.schedule_push_deliveries(scheduled_at) where status in ('pending','sending');
alter table public.schedule_push_deliveries enable row level security;
revoke all on public.schedule_push_deliveries from public,anon,authenticated;
grant all on public.schedule_push_deliveries to service_role;

create function public.morning_push_at(p_user uuid,p_day date,p_timezone text) returns timestamptz
language sql stable set search_path='' as $$
 select (p_day+time '08:00'+make_interval(mins=>get_byte(decode(md5(p_user::text),'hex'),0)%10)) at time zone p_timezone;
$$;
revoke all on function public.morning_push_at(uuid,date,text) from public,anon,authenticated;

create function public.morning_push_candidates(p_now timestamptz default now(),p_subscription uuid default null)
returns table(subscription_id uuid,day date,scheduled_at timestamptz,item_count bigint)
language sql stable security definer set search_path='' as $$
 select s.id,local.day,local.scheduled,items.n
 from public.web_push_subscriptions s join public.notification_preferences p on p.user_id=s.user_id and p.schedule_enabled
 join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
 cross join lateral(select (p_now at time zone profile.timezone)::date as day,
 public.morning_push_at(s.user_id,(p_now at time zone profile.timezone)::date,profile.timezone) as scheduled) local
 cross join lateral(select count(*) n from public.schedule_items(s.user_id,local.day)) items
 where (p_subscription is null or s.id=p_subscription) and items.n>0 and p_now>=local.scheduled and p_now<local.scheduled+interval '10 minutes'
 and greatest(s.created_at,p.schedule_enabled_at)<=((local.day+time '08:00') at time zone profile.timezone)
 and public.guardian_declared(s.user_id)
 and (p.snooze_until is null or p.snooze_until<=p_now);
$$;
revoke all on function public.morning_push_candidates(timestamptz,uuid) from public,anon,authenticated;

create function public.claim_schedule_push(p_token text)
returns table(id uuid,lease_token uuid,endpoint text,p256dh text,auth_key text,locale text,day date,item_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.feeding_push_config c join vault.decrypted_secrets v on v.id=c.token_secret_id where v.decrypted_secret=p_token) then raise exception 'forbidden' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(729099) then return; end if;
 insert into public.schedule_push_deliveries(subscription_id,day,scheduled_at)
 select c.subscription_id,c.day,c.scheduled_at from public.morning_push_candidates() c on conflict on constraint schedule_push_deliveries_subscription_id_day_key do nothing;
 update public.schedule_push_deliveries d set status='failed' where d.status='sending' and d.attempts>=3 and d.leased_until<now();
 update public.schedule_push_deliveries d set status='cancelled' where (d.status='pending' or (d.status='sending' and d.leased_until<now()))
 and not exists(select 1 from public.morning_push_candidates(now(),d.subscription_id) c where c.subscription_id=d.subscription_id and c.day=d.day and c.scheduled_at=d.scheduled_at);
 return query with picked as (
 select d.id from public.schedule_push_deliveries d where d.attempts<3 and d.scheduled_at<=now()
 and (d.status='pending' or (d.status='sending' and d.leased_until<now())) order by d.scheduled_at limit 10 for update skip locked
 ), leased as (
 update public.schedule_push_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
 from picked where picked.id=d.id returning d.*
 ) select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth_key,s.locale,d.day,c.item_count from leased d
 join public.web_push_subscriptions s on s.id=d.subscription_id
 join lateral public.morning_push_candidates(now(),d.subscription_id) c on c.subscription_id=d.subscription_id and c.day=d.day and c.scheduled_at=d.scheduled_at;
end $$;
create function public.validate_schedule_push(p_id uuid,p_lease uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.schedule_push_deliveries d join lateral public.morning_push_candidates(now(),d.subscription_id) c on c.subscription_id=d.subscription_id and c.day=d.day and c.scheduled_at=d.scheduled_at
 where d.id=p_id and d.lease_token=p_lease and d.status='sending' and d.leased_until>now());
$$;
create function public.finish_schedule_push(p_id uuid,p_lease uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result is null or p_result not in ('sent','retry','gone','cancelled') then raise exception 'invalid result'; end if;
 if p_result='gone' then
 delete from public.web_push_subscriptions s using public.schedule_push_deliveries d where d.id=p_id and d.lease_token=p_lease and d.status='sending' and s.id=d.subscription_id;
 else
 update public.schedule_push_deliveries d set status=case when p_result='retry' then case when d.attempts>=3 then 'failed' else 'pending' end else p_result end,
 sent_at=case when p_result='sent' then now() else null end,leased_until=null where d.id=p_id and d.lease_token=p_lease and d.status='sending';
 end if;
end $$;
revoke all on function public.claim_schedule_push(text),public.validate_schedule_push(uuid,uuid),public.finish_schedule_push(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_schedule_push(text),public.validate_schedule_push(uuid,uuid),public.finish_schedule_push(uuid,uuid,text) to service_role;

create or replace function public.dispatch_feeding_push() returns void language plpgsql security definer set search_path='' as $$
declare config public.feeding_push_config; token text;
begin
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
 delete from public.playground_push_deliveries where scheduled_at<now()-interval '2 days';
 delete from public.schedule_push_deliveries where scheduled_at<now()-interval '30 days';
 if not exists(select 1 from public.feeding_push_candidates() c join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
 where not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=c.subscription_id and d.record_id=c.record_id and d.reference=p.feeding_reference and (d.status in ('sent','failed') or (d.status='cancelled' and d.scheduled_at=c.scheduled_at) or (d.status='sending' and d.leased_until>now()))))
 and not exists(select 1 from public.playground_push_deliveries d where d.attempts<3 and d.scheduled_at<=now() and (d.status='pending' or (d.status='sending' and d.leased_until<now())))
 and not exists(select 1 from public.morning_push_candidates() c where not exists(select 1 from public.schedule_push_deliveries d where d.subscription_id=c.subscription_id and d.day=c.day and (d.status in ('sent','failed','cancelled') or (d.status='sending' and d.leased_until>now())))) then return; end if;
 select * into config from public.feeding_push_config; if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podung-worker-token',token),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
commit;
