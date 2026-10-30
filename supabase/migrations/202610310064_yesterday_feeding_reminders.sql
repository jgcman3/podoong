begin;
alter table public.notification_preferences add column feeding_reference text not null default 'interval' check(feeding_reference in ('interval','yesterday'));
alter table public.feeding_push_deliveries add column reference text not null default 'interval' check(reference in ('interval','yesterday'));
alter table public.feeding_push_deliveries drop constraint feeding_push_deliveries_subscription_id_record_id_key;
alter table public.feeding_push_deliveries add constraint feeding_push_delivery_source_key unique(subscription_id,record_id,reference);
create index feeding_push_recent_sent on public.feeding_push_deliveries(subscription_id,child_id,sent_at desc) where status='sent';

-- One account-wide mode; subscription removal remains device-specific.
create function public.save_feeding_reminder(p_mode text,p_interval integer,p_quiet boolean,p_subscription jsonb default null,p_locale text default 'ko') returns uuid
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if p_mode is null or p_mode not in ('interval','yesterday','off') then raise exception 'invalid mode' using errcode='22023'; end if;
 perform public.save_feeding_push_preferences(p_mode<>'off',p_interval,p_quiet);
 update public.notification_preferences set feeding_reference=case when p_mode='yesterday' then 'yesterday' else 'interval' end where user_id=auth.uid();
 if p_subscription is not null then
   if p_mode='off' then raise exception 'disabled mode' using errcode='22023'; end if;
   device:=public.register_feeding_push(p_subscription->>'endpoint',p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth',p_locale);
 end if;
 return device;
end $$;
revoke all on function public.save_feeding_reminder(text,integer,boolean,jsonb,text) from public,anon;
grant execute on function public.save_feeding_reminder(text,integer,boolean,jsonb,text) to authenticated;

-- Use local calendar arithmetic so DST and half-hour zones retain the wall clock.
create function public.feeding_reference_time(p_started timestamptz,p_timezone text) returns timestamptz
language sql immutable set search_path='' as $$
 select case when (due at time zone p_timezone)=local_due then due end
 from (select (p_started at time zone p_timezone)+interval '1 day' local_due) a
 cross join lateral (select local_due at time zone p_timezone due) b;
$$;
revoke all on function public.feeding_reference_time(timestamptz,text) from public,anon,authenticated;

create or replace function public.feeding_push_candidates()
returns table(subscription_id uuid,child_id uuid,record_id uuid,scheduled_at timestamptz)
language sql stable security definer set search_path='' as $$
 with eligible as materialized (
   select s.id subscription_id,s.created_at,child.id child_id,p.feeding_reference,p.feeding_interval_minutes,profile.timezone
   from public.web_push_subscriptions s
   join public.notification_preferences p on p.user_id=s.user_id and p.feeding_enabled
   join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
   join public.family_members m on m.user_id=s.user_id
   join public.children child on child.family_id=m.family_id
   where public.notification_child_access(s.user_id,child.id)
   and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.user_id)
   and (p.snooze_until is null or p.snooze_until<=now())
   and not public.notification_quiet(p.quiet_start,p.quiet_end,(now() at time zone profile.timezone)::time)
 ), candidates as (
   select e.subscription_id,e.child_id,r.id record_id,r.started_at+make_interval(mins=>e.feeding_interval_minutes) scheduled_at,e.created_at
   from eligible e
   join lateral (select r.id,r.kind,r.started_at,r.ended_at from public.care_records r where r.child_id=e.child_id and r.kind in ('breast','formula','solids') order by r.started_at desc,r.id desc limit 1) r on true
   where e.feeding_reference='interval' and (r.kind<>'breast' or r.ended_at is not null)
   union all
   select e.subscription_id,e.child_id,r.id,shifted.due,e.created_at
   from eligible e
   join public.care_records r on r.child_id=e.child_id and r.kind in ('breast','formula','solids')
     and r.started_at>=(((now() at time zone e.timezone)::date-1)::timestamp at time zone e.timezone)
     and r.started_at<((now() at time zone e.timezone)::date::timestamp at time zone e.timezone)
   cross join lateral (select public.feeding_reference_time(r.started_at,e.timezone) due) shifted
   where e.feeding_reference='yesterday' and (r.kind<>'breast' or r.ended_at is not null)
   -- Same wall-clock time, not a fixed 24-hour offset. Skip nonexistent DST times.
   and (shifted.due at time zone e.timezone)=(r.started_at at time zone e.timezone)+interval '1 day'
   and not exists(select 1 from public.care_records today where today.child_id=e.child_id and today.kind in ('breast','formula','solids') and today.started_at between now()-interval '90 minutes' and now())
   -- Clustered records must not become repeated notifications for the same child.
   and not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=e.subscription_id and d.child_id=e.child_id and d.status='sent' and d.sent_at>now()-interval '60 minutes')
 )
 select distinct on(c.subscription_id,c.child_id) c.subscription_id,c.child_id,c.record_id,c.scheduled_at
 from candidates c where c.scheduled_at between greatest(c.created_at,now()-interval '30 minutes') and now()
 order by c.subscription_id,c.child_id,c.scheduled_at desc,c.record_id desc;
$$;

drop function public.claim_feeding_push(text);
create function public.claim_feeding_push(p_token text)
returns table(id uuid,lease_token uuid,endpoint text,p256dh text,auth_key text,locale text,child_id uuid,reference text,meal_kind text)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.feeding_push_config c join vault.decrypted_secrets v on v.id=c.token_secret_id where v.decrypted_secret=p_token) then raise exception 'forbidden' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(729055) then return; end if;
 update public.feeding_push_deliveries d set status='failed' where d.status='sending' and d.attempts>=3 and d.leased_until<now();
 insert into public.feeding_push_deliveries(subscription_id,child_id,record_id,scheduled_at,reference)
 select c.subscription_id,c.child_id,c.record_id,c.scheduled_at,p.feeding_reference from public.feeding_push_candidates() c join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
 on conflict on constraint feeding_push_delivery_source_key do update
 set scheduled_at=excluded.scheduled_at,status='pending',attempts=0
 where feeding_push_deliveries.status in ('pending','cancelled') and feeding_push_deliveries.scheduled_at is distinct from excluded.scheduled_at;
 update public.feeding_push_deliveries d set status='cancelled'
 where (d.status='pending' or (d.status='sending' and d.leased_until<now())) and not exists(
   select 1 from public.feeding_push_candidates() c join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
   where c.subscription_id=d.subscription_id and c.record_id=d.record_id and c.scheduled_at=d.scheduled_at and p.feeding_reference=d.reference);
 return query with picked as (
 select d.id from public.feeding_push_deliveries d where d.attempts<3 and (d.status='pending' or (d.status='sending' and d.leased_until<now())) order by d.scheduled_at limit 50 for update skip locked
 ), leased as (
 update public.feeding_push_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' from picked where d.id=picked.id returning d.*
 ) select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth_key,s.locale,d.child_id,d.reference,r.kind::text from leased d join public.web_push_subscriptions s on s.id=d.subscription_id join public.care_records r on r.id=d.record_id;
end $$;
revoke all on function public.claim_feeding_push(text) from public,anon,authenticated;
grant execute on function public.claim_feeding_push(text) to service_role;

create or replace function public.validate_feeding_push(p_id uuid,p_lease uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.feeding_push_deliveries d
 join public.feeding_push_candidates() c on c.subscription_id=d.subscription_id and c.record_id=d.record_id and c.scheduled_at=d.scheduled_at
 join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id and p.feeding_reference=d.reference
 where d.id=p_id and d.lease_token=p_lease and d.status='sending' and d.leased_until>now());
$$;

create or replace function public.dispatch_feeding_push() returns void language plpgsql security definer set search_path='' as $$
declare config public.feeding_push_config; token text;
begin
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
 if not exists(select 1 from public.feeding_push_candidates() c
 join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
 where not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=c.subscription_id and d.record_id=c.record_id and d.reference=p.feeding_reference and (d.status in ('sent','failed') or (d.status='cancelled' and d.scheduled_at=c.scheduled_at) or (d.status='sending' and d.leased_until>now())))) then return; end if;
 select * into config from public.feeding_push_config;
 if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podung-worker-token',token),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
commit;
