begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create table public.feeding_push_config(
 singleton boolean primary key default true check(singleton),public_key text not null,
 worker_url text not null,token_secret_id uuid not null,updated_at timestamptz not null default now()
);
create table public.web_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|[a-z0-9-]+[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/'),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),auth_key text not null check(auth_key ~ '^[A-Za-z0-9_-]{22}$'),
 locale text not null check(locale in ('ko','en')),created_at timestamptz not null default clock_timestamp()
);
create index on public.web_push_subscriptions(user_id);
create table public.feeding_push_deliveries(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.web_push_subscriptions on delete cascade,
 child_id uuid not null references public.children on delete cascade,record_id uuid not null references public.care_records on delete cascade,
 scheduled_at timestamptz not null,status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed')),
 attempts integer not null default 0,lease_token uuid,leased_until timestamptz,sent_at timestamptz,
 unique(subscription_id,record_id)
);
create index on public.feeding_push_deliveries(status,leased_until);
create index on public.feeding_push_deliveries(scheduled_at);
alter table public.feeding_push_config enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.feeding_push_deliveries enable row level security;
create policy own_push_subscription on public.web_push_subscriptions for select to authenticated using(user_id=auth.uid() and public.account_active());
revoke all on public.feeding_push_config,public.feeding_push_deliveries,public.web_push_subscriptions from anon,authenticated;
grant select on public.web_push_subscriptions to authenticated;
grant all on public.feeding_push_config,public.feeding_push_deliveries,public.web_push_subscriptions to service_role;

create function public.get_feeding_push_config() returns text language sql stable security definer set search_path='' as $$
 select public_key from public.feeding_push_config where public.account_active() and auth.uid() is not null;
$$;
create function public.save_feeding_push_preferences(p_enabled boolean,p_interval integer,p_quiet boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.account_active() or not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_enabled is null or p_quiet is null or p_interval is null or p_interval not between 30 and 1440 then raise exception 'invalid interval' using errcode='22023'; end if;
 insert into public.notification_preferences(user_id,task_enabled,event_enabled,feeding_enabled,feeding_interval_minutes,quiet_start,quiet_end)
 values(auth.uid(),false,false,p_enabled,p_interval,case when p_quiet then '22:00'::time else '00:00'::time end,case when p_quiet then '07:00'::time else '00:00'::time end)
 on conflict(user_id) do update set feeding_enabled=excluded.feeding_enabled,feeding_interval_minutes=excluded.feeding_interval_minutes,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,snooze_until=null;
end $$;
create function public.register_feeding_push(p_endpoint text,p_p256dh text,p_auth text,p_locale text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not public.account_active() or not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.feeding_push_config) then raise exception 'not configured'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.web_push_subscriptions where user_id=auth.uid())>=5 and not exists(select 1 from public.web_push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint) then raise exception 'device limit'; end if;
 insert into public.web_push_subscriptions(user_id,endpoint,p256dh,auth_key,locale) values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_locale)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,locale=excluded.locale where web_push_subscriptions.user_id=auth.uid() returning id into result;
 if result is null then raise exception 'forbidden' using errcode='42501'; end if;
 return result;
end $$;
create function public.remove_feeding_push(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin delete from public.web_push_subscriptions where id=p_id and user_id=auth.uid(); end $$;

create function public.enable_feeding_push(p_subscription jsonb,p_interval integer,p_quiet boolean,p_locale text) returns uuid language plpgsql security definer set search_path='' as $$
declare id uuid;
begin
 perform public.save_feeding_push_preferences(true,p_interval,p_quiet);
 id:=public.register_feeding_push(p_subscription->>'endpoint',p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth',p_locale);
 return id;
end $$;
revoke all on function public.enable_feeding_push(jsonb,integer,boolean,text) from public,anon;
grant execute on function public.enable_feeding_push(jsonb,integer,boolean,text) to authenticated;
create index if not exists care_latest_meal_push on public.care_records(child_id,started_at desc,id desc) where kind in ('breast','formula','solids');

-- All three meal kinds use the start time, including bottle/solids without duration.
-- A single reminder per last meal/device; stale meals are never backfilled after a long outage.
create function public.feeding_push_candidates()
returns table(subscription_id uuid,child_id uuid,record_id uuid,scheduled_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.id,r.child_id,r.id,r.started_at+make_interval(mins=>p.feeding_interval_minutes)
 from public.web_push_subscriptions s join public.notification_preferences p on p.user_id=s.user_id and p.feeding_enabled
 join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
 join public.family_members m on m.user_id=s.user_id join public.children child on child.family_id=m.family_id
 join lateral (select r.* from public.care_records r where r.child_id=child.id and r.kind in ('breast','formula','solids') order by r.started_at desc,r.id desc limit 1) r on true
 where public.notification_child_access(s.user_id,r.child_id)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.user_id)
 and (r.kind<>'breast' or r.ended_at is not null)
 and (p.snooze_until is null or p.snooze_until<=now())
 and not public.notification_quiet(p.quiet_start,p.quiet_end,(now() at time zone profile.timezone)::time)
 and r.started_at+make_interval(mins=>p.feeding_interval_minutes) between greatest(s.created_at,now()-interval '30 minutes') and now();
$$;
create function public.claim_feeding_push(p_token text)
returns table(id uuid,lease_token uuid,endpoint text,p256dh text,auth_key text,locale text,child_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.feeding_push_config c join vault.decrypted_secrets v on v.id=c.token_secret_id where v.decrypted_secret=p_token) then raise exception 'forbidden' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(729055) then return; end if;
 update public.feeding_push_deliveries d set status='failed' where d.status='sending' and d.attempts>=3 and d.leased_until<now();
 insert into public.feeding_push_deliveries(subscription_id,child_id,record_id,scheduled_at)
 select * from public.feeding_push_candidates() on conflict(subscription_id,record_id) do update
 set scheduled_at=excluded.scheduled_at,status='pending',attempts=0
 where feeding_push_deliveries.status in ('pending','cancelled') and feeding_push_deliveries.scheduled_at is distinct from excluded.scheduled_at;
 update public.feeding_push_deliveries d set status='cancelled' where (d.status='pending' or (d.status='sending' and d.leased_until<now())) and not exists(select 1 from public.feeding_push_candidates() c where c.subscription_id=d.subscription_id and c.record_id=d.record_id and c.scheduled_at=d.scheduled_at);
 return query with picked as (
 select d.id from public.feeding_push_deliveries d where d.attempts<3 and (d.status='pending' or (d.status='sending' and d.leased_until<now())) order by d.scheduled_at limit 50 for update skip locked
 ), leased as (
 update public.feeding_push_deliveries d set status='sending',attempts=d.attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes' from picked where d.id=picked.id returning d.*
 ) select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth_key,s.locale,d.child_id from leased d join public.web_push_subscriptions s on s.id=d.subscription_id;
end $$;
create function public.validate_feeding_push(p_id uuid,p_lease uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.feeding_push_deliveries d join public.feeding_push_candidates() c on c.subscription_id=d.subscription_id and c.record_id=d.record_id and c.scheduled_at=d.scheduled_at where d.id=p_id and d.lease_token=p_lease and d.status='sending' and d.leased_until>now());
$$;
create function public.finish_feeding_push(p_id uuid,p_lease uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result not in ('sent','retry','gone','cancelled') or p_result is null then raise exception 'invalid result'; end if;
 if p_result='gone' then
 delete from public.web_push_subscriptions s using public.feeding_push_deliveries d where d.id=p_id and d.lease_token=p_lease and d.status='sending' and s.id=d.subscription_id;
 else
 update public.feeding_push_deliveries d set status=case when p_result='retry' then case when d.attempts>=3 then 'failed' else 'pending' end else p_result end,sent_at=case when p_result='sent' then now() else null end,leased_until=null
 where d.id=p_id and d.lease_token=p_lease and d.status='sending';
 end if;
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
end $$;
create function public.dispatch_feeding_push() returns void language plpgsql security definer set search_path='' as $$
declare config public.feeding_push_config; token text;
begin
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
 if not exists(select 1 from public.feeding_push_candidates() c where not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=c.subscription_id and d.record_id=c.record_id and (d.status in ('sent','failed') or (d.status='cancelled' and d.scheduled_at=c.scheduled_at) or (d.status='sending' and d.leased_until>now())))) then return; end if;
 select * into config from public.feeding_push_config;
 if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podung-worker-token',token),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
create function public.configure_feeding_push(p_public_key text,p_worker_url text) returns void language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if p_public_key !~ '^[A-Za-z0-9_-]{87}$' or p_worker_url !~ '^https://[a-z0-9]{20}[.]supabase[.]co/functions/v1/feeding-push$' then raise exception 'invalid config'; end if;
 select token_secret_id into secret_id from public.feeding_push_config;
 if secret_id is null then select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'podung_feeding_push_worker') into secret_id; end if;
 insert into public.feeding_push_config(singleton,public_key,worker_url,token_secret_id) values(true,p_public_key,p_worker_url,secret_id)
 on conflict(singleton) do update set public_key=excluded.public_key,worker_url=excluded.worker_url,updated_at=now();
 perform cron.schedule('podung-feeding-push','* * * * *','select public.dispatch_feeding_push()');
end $$;
revoke all on function public.get_feeding_push_config(),public.save_feeding_push_preferences(boolean,integer,boolean),public.register_feeding_push(text,text,text,text),public.remove_feeding_push(uuid) from public,anon;
grant execute on function public.get_feeding_push_config(),public.save_feeding_push_preferences(boolean,integer,boolean),public.register_feeding_push(text,text,text,text),public.remove_feeding_push(uuid) to authenticated;
revoke all on function public.feeding_push_candidates(),public.claim_feeding_push(text),public.validate_feeding_push(uuid,uuid),public.finish_feeding_push(uuid,uuid,text),public.dispatch_feeding_push(),public.configure_feeding_push(text,text) from public,anon,authenticated;
grant execute on function public.claim_feeding_push(text),public.validate_feeding_push(uuid,uuid),public.finish_feeding_push(uuid,uuid,text),public.configure_feeding_push(text,text) to service_role;
commit;
