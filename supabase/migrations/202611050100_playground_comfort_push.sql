begin;
create or replace function public.queue_playground_push() returns trigger language plpgsql security definer set search_path='' as $$
declare bucket timestamptz:=date_bin(interval '2 minutes',new.created_at,'2000-01-01'::timestamptz);
begin
 if new.kind not in ('wave','heart','comfort') then return new; end if;
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

drop function public.claim_playground_push(text);
drop function public.playground_push_batch(uuid);
create function public.playground_push_batch(p_id uuid)
returns table(wave_count bigint,heart_count bigint,comfort_count bigint)
language sql stable security definer set search_path='' as $$
 select count(*) filter(where r.kind='wave'),count(*) filter(where r.kind='heart'),count(*) filter(where r.kind='comfort')
 from public.playground_push_deliveries d
 join public.web_push_subscriptions s on s.id=d.subscription_id
 join public.notification_preferences p on p.user_id=s.user_id and p.playground_enabled
 join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
 join public.children child on child.id=d.child_id
 join public.families family on family.id=child.family_id and family.merged_into is null
 join public.parenting_playground_regions region on region.id=public.playground_region(family.id)
 join public.parenting_playground_reactions r on r.receiver_child=d.child_id and r.kind in ('wave','heart','comfort')
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
returns table(id uuid,lease_token uuid,endpoint text,p256dh text,auth_key text,locale text,child_id uuid,wave_count bigint,heart_count bigint,comfort_count bigint)
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
 ) select d.id,d.lease_token,s.endpoint,s.p256dh,s.auth_key,s.locale,d.child_id,b.wave_count,b.heart_count,b.comfort_count
 from leased d join public.web_push_subscriptions s on s.id=d.subscription_id cross join lateral public.playground_push_batch(d.id) b;
end $$;
revoke all on function public.claim_playground_push(text) from public,anon,authenticated;
grant execute on function public.claim_playground_push(text) to service_role;
commit;
