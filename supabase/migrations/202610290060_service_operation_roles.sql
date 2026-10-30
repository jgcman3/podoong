begin;
CREATE OR REPLACE FUNCTION public.operation_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if not public.service_admin_access() then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('window_days',28,'active_families',(select count(distinct family_id) from public.usage_events where occurred_at>=now()-interval '28 days'),'collaborating_families',(select count(*) from (select family_id from public.usage_events where occurred_at>=now()-interval '28 days' and family_id is not null group by family_id having count(distinct user_id)>1) x),'eligible_4week_users',(select count(*) from public.profiles where created_at<=now()-interval '35 days'),'retained_4week_users',(select count(distinct p.id) from public.profiles p join public.usage_events u on u.user_id=p.id and u.occurred_at>=p.created_at+interval '28 days' and u.occurred_at<p.created_at+interval '35 days' where p.created_at<=now()-interval '35 days'),'database_bytes',pg_database_size(current_database()),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects));
end $function$;
CREATE OR REPLACE FUNCTION public.retry_data_operation(p_job uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if not public.service_admin_access() then raise exception 'forbidden' using errcode='42501'; end if;
 update public.data_operation_jobs set status='pending',attempts=0,lease_token=null,leased_until=null,error_code=null where id=p_job and status='failed' and (leased_until is null or leased_until<now());
 if not found then raise exception 'job not retryable' using errcode='22023'; end if;
 insert into public.data_operation_history(job_id,status) values(p_job,'manual_retry');
end $function$;
drop policy job_status on public.data_operation_jobs;
create policy job_status on public.data_operation_jobs for select to authenticated
using(user_id=auth.uid() or public.service_admin_access());
drop policy job_history on public.data_operation_history;
create policy job_history on public.data_operation_history for select to authenticated
using(exists(select 1 from public.data_operation_jobs j where j.id=job_id and (j.user_id=auth.uid() or public.service_admin_access())));
commit;
