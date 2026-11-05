begin;
-- Push validation runs in a read-only REST transaction; it must not register regions.
create function public.playground_region_key(p_family uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(f.residence_country_code,
  case when f.residence_country_code='KR' then '' else coalesce(f.residence_province,'') end,
  f.residence_city,f.residence_locality)::text)::uuid
 from public.families f where f.id=p_family and f.merged_into is null
 and nullif(f.residence_country_code,'') is not null
 and nullif(f.residence_city,'') is not null
 and nullif(f.residence_locality,'') is not null;
$$;
revoke all on function public.playground_region_key(uuid) from public,anon,authenticated;

create or replace function public.playground_push_batch(p_id uuid)
returns table(wave_count bigint,heart_count bigint,comfort_count bigint)
language sql stable security definer set search_path='' as $$
 select count(*) filter(where r.kind='wave'),count(*) filter(where r.kind='heart'),count(*) filter(where r.kind='comfort')
 from public.playground_push_deliveries d
 join public.web_push_subscriptions s on s.id=d.subscription_id
 join public.notification_preferences p on p.user_id=s.user_id and p.playground_enabled
 join public.profiles profile on profile.id=s.user_id and profile.consented_at is not null
 join public.children child on child.id=d.child_id
 join public.families family on family.id=child.family_id and family.merged_into is null
 join public.parenting_playground_regions region on region.id=public.playground_region_key(family.id)
 join public.parenting_playground_reactions r on r.receiver_child=d.child_id and r.kind in ('wave','heart','comfort')
  and r.day=(now() at time zone region.timezone)::date
  and r.created_at>=greatest(d.batch_start,s.created_at,p.playground_enabled_at) and r.created_at<d.scheduled_at
 join public.children sender on sender.id=r.sender_child
 join public.families sender_family on sender_family.id=sender.family_id and sender_family.merged_into is null
 where d.id=p_id and d.scheduled_at between now()-interval '10 minutes' and now()
 and public.notification_child_access(s.user_id,d.child_id)
 and public.child_privacy_allowed(d.child_id,'neighborhood') and public.child_privacy_allowed(r.sender_child,'neighborhood')
 and public.playground_region_key(sender.family_id)=region.id
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.user_id)
 and (not p.playground_quiet or not public.notification_quiet('22:00','07:00',(now() at time zone profile.timezone)::time))
 and (p.snooze_until is null or p.snooze_until<=now())
 having count(*)>0;
$$;
revoke all on function public.playground_push_batch(uuid) from public,anon,authenticated;

commit;
