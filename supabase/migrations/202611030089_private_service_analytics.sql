begin;
-- Screen counts have no visitor identity or request metadata, even temporarily in a table.
create table public.service_usage_daily (
 day date not null,
 screen text not null check(screen in ('today','calendar','insights','diary','community','account')),
 views bigint not null default 0 check(views>=0),
 primary key(day,screen)
);
alter table public.service_usage_daily enable row level security;
revoke all on public.service_usage_daily from public,anon,authenticated;
create function public.record_service_page_view(p_screen text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_screen is null or p_screen not in ('today','calendar','insights','diary','community','account') then raise exception 'invalid screen' using errcode='22023'; end if;
 insert into public.service_usage_daily(day,screen,views) values((now() at time zone 'Asia/Seoul')::date,p_screen,1)
 on conflict(day,screen) do update set views=public.service_usage_daily.views+1;
end $$;
create function public.admin_service_page_views(p_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 if p_days is null or p_days not in (7,14,28) then raise exception 'invalid period' using errcode='22023'; end if;
 return jsonb_build_object('days',p_days,'timezone','Asia/Seoul','screens',(
 select jsonb_agg(jsonb_build_object('screen',s.screen,'views',coalesce(c.views,0)) order by s.position)
 from unnest(array['today','calendar','insights','diary','community','account']) with ordinality s(screen,position)
 left join (select screen,sum(views) views from public.service_usage_daily where day between (now() at time zone 'Asia/Seoul')::date-(p_days-1) and (now() at time zone 'Asia/Seoul')::date group by screen) c using(screen)));
end $$;
revoke all on function public.record_service_page_view(text),public.admin_service_page_views(integer) from public,anon;
grant execute on function public.record_service_page_view(text),public.admin_service_page_views(integer) to authenticated;

-- Derive operations counts from retained records, not a second event history.
-- Four-week retention uses signup cohorts aged 35–63 days and a 35-day record window.
create or replace function public.operation_metrics() returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare result jsonb; begin
 perform public.require_service_admin();
 with records as materialized (
 select c.family_id,r.created_by,r.created_at from public.care_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '35 days'
 union all select c.family_id,r.created_by,r.created_at from public.child_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '35 days'
 ) select jsonb_build_object('window_days',28,
 'active_families',(select count(distinct family_id) from records where created_at>=now()-interval '28 days'),
 'collaborating_families',(select count(*) from (select family_id from records where created_at>=now()-interval '28 days' group by family_id having count(distinct created_by)>1) f),
 'eligible_4week_users',(select count(*) from public.profiles where created_at<=now()-interval '35 days' and created_at>=now()-interval '63 days'),
 'retained_4week_users',(select count(distinct p.id) from public.profiles p join records r on r.created_by=p.id and r.created_at>=p.created_at+interval '28 days' and r.created_at<p.created_at+interval '35 days' where p.created_at<=now()-interval '35 days' and p.created_at>=now()-interval '63 days'),
 'database_bytes',pg_database_size(current_database()),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects)) into result;
 return result;
end $$;
drop trigger if exists usage_records on public.care_records;
drop trigger if exists usage_tasks on public.tasks;
drop trigger if exists usage_members on public.family_members;
drop trigger if exists usage_polls on public.daily_poll_votes;
drop function public.capture_usage_event();
drop table public.usage_events;

create function public.cleanup_service_usage() returns void language sql security definer set search_path='' as $$
 delete from public.service_usage_daily where day<(now() at time zone 'Asia/Seoul')::date-89;
 -- The latest moderation timestamp prevents an old, recently closed request being removed immediately.
 delete from public.developer_requests r where r.status in ('done','closed')
 and greatest(r.created_at,coalesce((select d.updated_at from public.admin_request_details d where d.request_id=r.id),r.created_at))<now()-interval '180 days';
$$;
revoke all on function public.cleanup_service_usage() from public,anon,authenticated;
select cron.schedule('podoong-service-usage-retention','25 18 * * *','select public.cleanup_service_usage()');
comment on table public.service_usage_daily is 'Anonymous daily screen totals, retained for 90 calendar days. No visitor identity or request metadata.';
commit;
