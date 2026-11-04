begin;
alter table public.profiles add column service_tour_completed_at timestamptz;
create function public.complete_service_tour() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
 update public.profiles set service_tour_completed_at=coalesce(service_tour_completed_at,now()) where id=auth.uid();
end $$;
revoke all on function public.complete_service_tour() from public,anon;
grant execute on function public.complete_service_tour() to authenticated;
commit;
