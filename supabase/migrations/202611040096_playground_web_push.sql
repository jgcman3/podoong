begin;
alter table public.notification_preferences
 add column playground_enabled boolean not null default false,
 add column playground_quiet boolean not null default true,
 add column playground_enabled_at timestamptz;

create function public.save_push_settings(p_mode text,p_interval integer,p_quiet boolean,p_playground boolean,p_playground_quiet boolean,p_subscription jsonb default null,p_locale text default 'ko') returns uuid
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if p_playground is null or p_playground_quiet is null or p_locale is null or p_locale not in ('ko','en') then raise exception 'invalid preferences' using errcode='22023'; end if;
 perform public.save_feeding_reminder(p_mode,p_interval,p_quiet,null,p_locale);
 update public.notification_preferences set playground_enabled=p_playground,playground_quiet=p_playground_quiet,
 playground_enabled_at=case when p_playground and not playground_enabled then now() else playground_enabled_at end where user_id=auth.uid();
 if p_subscription is not null then
  if p_mode='off' and not p_playground then raise exception 'disabled mode' using errcode='22023'; end if;
  device:=public.register_feeding_push(p_subscription->>'endpoint',p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth',p_locale);
 end if;
 return device;
end $$;
revoke all on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text) from public,anon;
grant execute on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text) to authenticated;

create table public.playground_push_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.web_push_subscriptions on delete cascade,
 child_id uuid not null references public.children on delete cascade,
 batch_start timestamptz not null,
 scheduled_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed')),
 attempts integer not null default 0,
 lease_token uuid,leased_until timestamptz,sent_at timestamptz,
 unique(subscription_id,child_id,batch_start)
);
create index playground_push_due on public.playground_push_deliveries(scheduled_at) where status in ('pending','sending');
alter table public.playground_push_deliveries enable row level security;
revoke all on public.playground_push_deliveries from public,anon,authenticated;
grant all on public.playground_push_deliveries to service_role;

-- Only new reactions enqueue work. One small batch per device/child/two-minute window.
create function public.queue_playground_push() returns trigger language plpgsql security definer set search_path='' as $$
declare bucket timestamptz:=date_bin(interval '2 minutes',new.created_at,'2000-01-01'::timestamptz);
begin
 if new.kind not in ('wave','heart') then return new; end if;
 insert into public.playground_push_deliveries(subscription_id,child_id,batch_start,scheduled_at)
 select s.id,new.receiver_child,bucket,bucket+interval '2 minutes'
 from public.web_push_subscriptions s join public.notification_preferences p on p.user_id=s.user_id and p.playground_enabled
 where public.notification_child_access(s.user_id,new.receiver_child) and s.user_id is distinct from auth.uid()
 and new.created_at>=greatest(s.created_at,p.playground_enabled_at)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.user_id)
 on conflict(subscription_id,child_id,batch_start) do nothing;
 return new;
end $$;
revoke all on function public.queue_playground_push() from public,anon,authenticated;
create trigger queue_playground_push after insert on public.parenting_playground_reactions for each row execute function public.queue_playground_push();

-- Recheck subscription, access, consent, current neighborhood/day and quiet hours at send time.
create function public.playground_push_batch(p_id uuid)
returns table(wave_count bigint,heart_count bigint)
language sql stable security definer set search_path='' as $$
 select count(*) filter(where r.kind='wave'),count(*) filter(where r.kind='heart')
 from public.playground_push_deliveries d
 join public.web_push_subscriptions s on s.id=d.subscription_id
 join public.notification_preferences p on p.user_id=s.user_id and p.playground_enabled
 join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
 join public.children child on child.id=d.child_id
 join public.families family on family.id=child.family_id and family.merged_into is null
 join public.parenting_playground_regions region on region.id=public.playground_region(family.id)
 join public.parenting_playground_reactions r on r.receiver_child=d.child_id and r.kind in ('wave','heart')
  and r.day=(now() at time zone region.timezone)::date
  and r.created_at>=greatest(d.batch_start,s.created_at,p.playground_enabled_at) and r.created_at<d.scheduled_at
 join public.children sender on sender.id=r.sender_child
 join public.families sender_family on sender_family.id=sender.family_id and sender_family.merged_into is null
 where d.id=p_id and d.scheduled_at between now()-interval '10 minutes' and now()
 and public.notification_child_access(s.user_id,d.child_id)
 and public.child_privacy_allowed(d.child_id,'neighborhood') and public.child_privacy_allowed(r.sender_child,'neighborhood')
 and public.playground_region(sender.family_id)=region.id
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.user_id)
 and (not p.playground_quiet or not public.notification_quiet('22:00','07:00',(now() at time zone profile.timezone)::time))
 and (p.snooze_until is null or p.snooze_until<=now())
 having count(*)>0;
$$;
revoke all on function public.playground_push_batch(uuid) from public,anon,authenticated;

create function public.claim_playground_push(p_token text)
returns table(id uuid,lease_token uuid,endpoint text,p256dh text,auth_key text,locale text,child_id uuid,wave_count bigint,heart_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.feeding_push_config c join vault.decrypted_secrets v on v.id=c.token_secret_id where v.decrypted_secret=p_token) then raise exception 'forbidden' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(729096) then return; end if;
 update public.playground_push_deliveries d set status='failed' where d.status='sending' and d.attempts>=3 and d.leased_until<now();
 update public.playground_push_deliveries d set status='cancelled'
 where (d.status='pending' or (d.status='sending' and d.leased_until<now())) and d.scheduled_at<=now()
 and not exists(select 1 from public.playground_push_batch(d.id));
 return query with picked as (
  select d.id from public.playground_push_deliveries d where d.attempts<3 and d.scheduled_at<=now()
   and (d.status='pending' or (d.status='sending' and d.leased_until<now()))
  order by d.scheduled_at limit 10 for update skip locked
 ), leased as (
  update public.playground_push_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
  from picked where d.id=picked.id returning d.*
 ) select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth_key,s.locale,d.child_id,b.wave_count,b.heart_count
 from leased d join public.web_push_subscriptions s on s.id=d.subscription_id cross join lateral public.playground_push_batch(d.id) b;
end $$;
create function public.validate_playground_push(p_id uuid,p_lease uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.playground_push_deliveries d cross join lateral public.playground_push_batch(d.id) b
 where d.id=p_id and d.lease_token=p_lease and d.status='sending' and d.leased_until>now());
$$;
create function public.finish_playground_push(p_id uuid,p_lease uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result is null or p_result not in ('sent','retry','gone','cancelled') then raise exception 'invalid result'; end if;
 if p_result='gone' then
  delete from public.web_push_subscriptions s using public.playground_push_deliveries d
  where d.id=p_id and d.lease_token=p_lease and d.status='sending' and s.id=d.subscription_id;
 else
  update public.playground_push_deliveries d set status=case when p_result='retry' then case when d.attempts>=3 then 'failed' else 'pending' end else p_result end,
  sent_at=case when p_result='sent' then now() else null end,leased_until=null
  where d.id=p_id and d.lease_token=p_lease and d.status='sending';
 end if;
end $$;
revoke all on function public.claim_playground_push(text),public.validate_playground_push(uuid,uuid),public.finish_playground_push(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_playground_push(text),public.validate_playground_push(uuid,uuid),public.finish_playground_push(uuid,uuid,text) to service_role;

-- Keep the existing single Cron, worker credential and VAPID keys.
create or replace function public.dispatch_feeding_push() returns void language plpgsql security definer set search_path='' as $$
declare config public.feeding_push_config; token text;
begin
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
 delete from public.playground_push_deliveries where scheduled_at<now()-interval '2 days';
 if not exists(select 1 from public.feeding_push_candidates() c
 join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
 where not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=c.subscription_id and d.record_id=c.record_id and d.reference=p.feeding_reference and (d.status in ('sent','failed') or (d.status='cancelled' and d.scheduled_at=c.scheduled_at) or (d.status='sending' and d.leased_until>now()))))
 and not exists(select 1 from public.playground_push_deliveries d where d.attempts<3 and d.scheduled_at<=now()
 and (d.status='pending' or (d.status='sending' and d.leased_until<now()))) then return; end if;
 select * into config from public.feeding_push_config;
 if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podung-worker-token',token),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
commit;
