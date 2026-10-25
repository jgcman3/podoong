create function public.retry_data_operation(p_job uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 update public.data_operation_jobs set status='pending',attempts=0,lease_token=null,leased_until=null,error_code=null where id=p_job and status='failed' and (leased_until is null or leased_until<now());
 if not found then raise exception 'job not retryable' using errcode='22023'; end if;
 insert into public.data_operation_history(job_id,status) values(p_job,'manual_retry');
end $$;
revoke all on function public.retry_data_operation(uuid) from public,anon;
grant execute on function public.retry_data_operation(uuid) to authenticated;
