begin;
create table public.service_admins(user_id uuid primary key references public.profiles on delete cascade,role text not null default 'owner' check(role in ('owner','operator')),created_at timestamptz not null default now());
create table public.admin_audit_log(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,action text not null check(action in ('request_update','error_resolve','admin_grant','admin_change','admin_revoke')),subject_id uuid not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index admin_audit_recent on public.admin_audit_log(created_at desc,id desc);
create function public.audit_service_admin_role() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; kind text; info jsonb;
begin
 select id into actor from public.profiles where id=auth.uid();
 if tg_op='INSERT' then target:=new.user_id; kind:='admin_grant'; info:=jsonb_build_object('role',new.role);
 elsif tg_op='DELETE' then target:=old.user_id; kind:='admin_revoke'; info:=jsonb_build_object('role',old.role);
 else
  if new.role=old.role and new.user_id=old.user_id then return new; end if;
  target:=new.user_id; kind:='admin_change'; info:=jsonb_build_object('from',old.role,'to',new.role);
 end if;
 insert into public.admin_audit_log(actor_id,action,subject_id,details) values(actor,kind,target,info);
 return coalesce(new,old);
end $$;
revoke all on function public.audit_service_admin_role() from public,anon,authenticated;
create trigger audit_service_admin_role after insert or update or delete on public.service_admins for each row execute function public.audit_service_admin_role();

create table public.admin_request_details(request_id uuid primary key references public.developer_requests on delete cascade,priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),internal_note text not null default '' check(length(internal_note)<=2000),version integer not null default 1,updated_by uuid references public.profiles on delete set null,updated_at timestamptz not null default now());
alter table public.developer_requests drop constraint developer_requests_status_check;
alter table public.developer_requests add constraint developer_requests_status_check check(status in ('received','reviewing','in_progress','done','closed'));
create table public.service_error_events(id uuid primary key,user_id uuid references public.profiles on delete cascade,section text not null check(section in ('today','calendar','insights','diary','account','admin','other')),code text not null check(code in ('render_failed','record_save_failed','photo_upload_failed','request_failed')),digest text check(digest ~ '^[0-9]{1,20}$'),created_at timestamptz not null default now(),resolved_at timestamptz,resolved_by uuid references public.profiles on delete set null);
create index service_error_recent on public.service_error_events(created_at desc,id desc);
create index service_error_user_rate on public.service_error_events(user_id,created_at desc);
create index admin_care_created on public.care_records(created_at,child_id);
create index admin_child_record_created on public.child_records(created_at,child_id);
alter table public.service_admins enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_request_details enable row level security;
alter table public.service_error_events enable row level security;
revoke all on public.service_admins,public.admin_audit_log,public.admin_request_details,public.service_error_events from public,anon,authenticated;
grant all on public.service_admins,public.admin_audit_log,public.admin_request_details,public.service_error_events to service_role;

create function public.is_service_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.account_active() and exists(select 1 from public.service_admins a join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and p.consented_at is not null);
$$;
create function public.service_admin_access() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_service_admin() and coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified' and f.factor_type='totp');
$$;
create function public.require_service_admin() returns void language plpgsql stable security definer set search_path='' as $$ begin
 if not public.service_admin_access() then raise exception 'forbidden' using errcode='42501'; end if;
end $$;

create function public.admin_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.require_service_admin();
 with records as (
 select c.family_id,r.created_by,r.created_at from public.care_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '7 days'
 union all select c.family_id,r.created_by,r.created_at from public.child_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '7 days'
 ), family_activity as (
 select family_id,count(distinct (created_at at time zone 'Asia/Seoul')::date) as days,count(distinct created_by) as caregivers from records group by family_id
 ) select jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'families',(select count(*) from public.families),
 'children',(select count(*) from public.children),
 'new_users_7d',(select count(*) from public.profiles where created_at>=now()-interval '7 days'),
 'active_families_7d',(select count(*) from family_activity),
 'steady_families_7d',(select count(*) from family_activity where days>=3),
 'collaborating_families_7d',(select count(*) from family_activity where caregivers>=2),
 'records_7d',(select count(*) from records),
 'open_requests',(select count(*) from public.developer_requests where status not in ('done','closed')),
 'unresolved_errors',(select count(*) from public.service_error_events where resolved_at is null),
 'failed_jobs',(select count(*) from public.data_operation_jobs where status='failed')+(select count(*) from public.feeding_push_deliveries where status='failed')+(select count(*) from public.notification_job_runs where status='failed'),
 'as_of',now()) into result;
 return result;
end $$;
create function public.admin_usage(p_days integer default 14) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.require_service_admin();
 if p_days not in (7,14,28) or p_days is null then raise exception 'invalid period' using errcode='22023'; end if;
 with records as (
 select c.family_id,r.created_by,r.created_at from public.care_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '35 days'
 union all select c.family_id,r.created_by,r.created_at from public.child_records r join public.children c on c.id=r.child_id where r.created_at>=now()-interval '35 days'
 ), days as (
 select generate_series((now() at time zone 'Asia/Seoul')::date-(p_days-1),(now() at time zone 'Asia/Seoul')::date,'1 day')::date as day
 ), daily as (
 select d.day,(select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Seoul')::date=d.day) as signups,
 count(r.created_at) as records,count(distinct r.family_id) as families
 from days d left join records r on (r.created_at at time zone 'Asia/Seoul')::date=d.day group by d.day
 ), cohort as (
 select f.id,f.created_at,exists(select 1 from public.children c where c.family_id=f.id) as has_child,
 exists(select 1 from records r where r.family_id=f.id) as has_record,
 (select count(distinct (r.created_at at time zone 'Asia/Seoul')::date)>=2 from records r where r.family_id=f.id) as returned
 from public.families f where f.created_at>=now()-interval '28 days'
 ) select jsonb_build_object('days',p_days,'timezone','Asia/Seoul','daily',coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily),'[]'::jsonb),
 'cohort',jsonb_build_object('families',(select count(*) from cohort),'with_child',(select count(*) from cohort where has_child),'with_record',(select count(*) from cohort where has_record),'returned',(select count(*) from cohort where returned)),
 'features',coalesce((select jsonb_agg(jsonb_build_object('feature',feature,'count',n) order by n desc,feature) from (
 select feature,count(*) as n from (
 select 'feeding' as feature from public.care_records where created_at>=now()-make_interval(days=>p_days)
 union all select case when service='growth' then 'diary' else service end from public.child_records where created_at>=now()-make_interval(days=>p_days)
 ) f group by feature) counts),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.admin_requests(p_status text default '',p_category text default '',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,user_id uuid,display_name text,category text,body text,status text,created_at timestamptz,priority text,internal_note text,version integer)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 if p_status not in ('','received','reviewing','in_progress','done','closed') or p_category not in ('','feature','bug','other') then raise exception 'invalid filter' using errcode='22023'; end if;
 return query select r.id,r.user_id,p.display_name,r.category,r.body,r.status,r.created_at,coalesce(d.priority,'normal'),coalesce(d.internal_note,''),coalesce(d.version,0)
 from public.developer_requests r join public.profiles p on p.id=r.user_id left join public.admin_request_details d on d.request_id=r.id
 where (p_status='' or r.status=p_status) and (p_category='' or r.category=p_category)
 and (p_before is null or (r.created_at,r.id)<(p_before,p_before_id))
 order by r.created_at desc,r.id desc limit 31;
end $$;
create function public.admin_update_request(p_id uuid,p_status text,p_priority text,p_note text,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare previous_status text; old_version integer;
begin
 perform public.require_service_admin();
 if p_status is null or p_status not in ('received','reviewing','in_progress','done','closed') or p_priority is null or p_priority not in ('low','normal','high','urgent') or p_note is null or length(p_note)>2000 or p_version is null or p_version<0 then raise exception 'invalid request update' using errcode='22023'; end if;
 select status into previous_status from public.developer_requests where id=p_id for update;
 if not found then raise exception 'not found' using errcode='P0002'; end if;
 select version into old_version from public.admin_request_details where request_id=p_id;
 if coalesce(old_version,0)<>p_version then raise exception 'conflict' using errcode='40001'; end if;
 update public.developer_requests set status=p_status where id=p_id;
 insert into public.admin_request_details(request_id,priority,internal_note,version,updated_by) values(p_id,p_priority,btrim(p_note),p_version+1,auth.uid())
 on conflict(request_id) do update set priority=excluded.priority,internal_note=excluded.internal_note,version=excluded.version,updated_by=excluded.updated_by,updated_at=now();
 insert into public.admin_audit_log(actor_id,action,subject_id,details) values(auth.uid(),'request_update',p_id,jsonb_build_object('from',previous_status,'to',p_status,'priority',p_priority));
end $$;

create function public.admin_users(p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,display_name text,locale text,created_at timestamptz,family_count bigint,deletion_requested boolean,is_admin boolean)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select p.id,p.display_name,p.locale,p.created_at,(select count(*) from public.family_members m where m.user_id=p.id),exists(select 1 from public.data_operation_jobs j where j.user_id=p.id),exists(select 1 from public.service_admins a where a.user_id=p.id)
 from public.profiles p where p_before is null or (p.created_at,p.id)<(p_before,p_before_id) order by p.created_at desc,p.id desc limit 31;
end $$;
create function public.admin_families(p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,name text,created_at timestamptz,country text,caregivers bigint,children bigint)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select f.id,f.name,f.created_at,f.residence_country_code,(select count(*) from public.family_members m where m.family_id=f.id),(select count(*) from public.children c where c.family_id=f.id)
 from public.families f where p_before is null or (f.created_at,f.id)<(p_before,p_before_id) order by f.created_at desc,f.id desc limit 31;
end $$;
create function public.admin_neighborhoods() returns table(region text,families bigint,opened boolean) language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select r.region,count(distinct r.family_id),coalesce(bool_or(o.opened_at is not null),false) from public.neighborhood_requests r left join public.neighborhood_openings o on o.region=r.region
 where public.neighborhood_region(r.family_id)=r.region group by r.region order by count(distinct r.family_id) desc,r.region limit 100;
end $$;

create function public.admin_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return jsonb_build_object('photo_cleanup',(select count(*) from public.child_photo_cleanup)+(select count(*) from public.community_photo_cleanup),
 'push_devices',(select count(*) from public.web_push_subscriptions),
 'push_sent_24h',(select count(*) from public.feeding_push_deliveries where sent_at>=now()-interval '24 hours'),
 'deletion_pending',(select count(*) from public.data_operation_jobs where status in ('pending','processing')),
 'push_configured',exists(select 1 from public.feeding_push_config),
 'push_schedule_active',exists(select 1 from cron.job where jobname='podung-feeding-push' and active),
 'failed',coalesce((select jsonb_agg(to_jsonb(f) order by f.at desc,f.id desc) from (
 select * from (
 select 'deletion' as source,id,created_at as at,status,attempts,error_code from public.data_operation_jobs where status='failed'
 union all select 'feeding_push',id,scheduled_at,status,attempts,null from public.feeding_push_deliveries where status='failed'
 union all select 'inbox',id,started_at,status,attempts,error_code from public.notification_job_runs where status='failed'
 ) failures order by at desc,id desc limit 50) f),'[]'::jsonb));
end $$;

create function public.report_service_error(p_id uuid,p_section text,p_code text,p_digest text default null) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.service_error_events where user_id=auth.uid() and created_at>=now()-interval '1 hour')>=20 then return; end if;
 insert into public.service_error_events(id,user_id,section,code,digest) values(p_id,auth.uid(),p_section,p_code,p_digest) on conflict(id) do nothing;
end $$;
create function public.admin_errors(p_open_only boolean default true,p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,section text,code text,digest text,created_at timestamptz,resolved_at timestamptz)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select e.id,e.section,e.code,e.digest,e.created_at,e.resolved_at from public.service_error_events e
 where (not p_open_only or e.resolved_at is null) and (p_before is null or (e.created_at,e.id)<(p_before,p_before_id)) order by e.created_at desc,e.id desc limit 31;
end $$;
create function public.admin_resolve_error(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 update public.service_error_events set resolved_at=now(),resolved_by=auth.uid() where id=p_id and resolved_at is null;
 if found then insert into public.admin_audit_log(actor_id,action,subject_id) values(auth.uid(),'error_resolve',p_id); end if;
end $$;
create function public.admin_audit(p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,actor_name text,action text,subject_id uuid,details jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query select a.id,coalesce(p.display_name,''),a.action,a.subject_id,a.details,a.created_at from public.admin_audit_log a left join public.profiles p on p.id=a.actor_id
 where p_before is null or (a.created_at,a.id)<(p_before,p_before_id) order by a.created_at desc,a.id desc limit 31;
end $$;

revoke all on function public.is_service_admin(),public.service_admin_access(),public.require_service_admin(),public.admin_dashboard(),public.admin_usage(integer),public.admin_requests(text,text,timestamptz,uuid),public.admin_update_request(uuid,text,text,text,integer),public.admin_users(timestamptz,uuid),public.admin_families(timestamptz,uuid),public.admin_neighborhoods(),public.admin_operations(),public.report_service_error(uuid,text,text,text),public.admin_errors(boolean,timestamptz,uuid),public.admin_resolve_error(uuid),public.admin_audit(timestamptz,uuid) from public,anon;
grant execute on function public.is_service_admin(),public.service_admin_access(),public.require_service_admin(),public.admin_dashboard(),public.admin_usage(integer),public.admin_requests(text,text,timestamptz,uuid),public.admin_update_request(uuid,text,text,text,integer),public.admin_users(timestamptz,uuid),public.admin_families(timestamptz,uuid),public.admin_neighborhoods(),public.admin_operations(),public.report_service_error(uuid,text,text,text),public.admin_errors(boolean,timestamptz,uuid),public.admin_resolve_error(uuid),public.admin_audit(timestamptz,uuid) to authenticated;
create function public.cleanup_admin_logs() returns void language sql security definer set search_path='' as $$
 delete from public.service_error_events where created_at<now()-interval '30 days';
 delete from public.admin_audit_log where created_at<now()-interval '365 days';
$$;
revoke all on function public.cleanup_admin_logs() from public,anon,authenticated;
select cron.schedule('podung-admin-retention','15 18 * * *','select public.cleanup_admin_logs()');
commit;
