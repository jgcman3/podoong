begin;
-- Service administrators still need an active, consented login and a trusted role grant.
-- MFA is temporarily optional; family/community roles never grant service access.
create or replace function public.service_admin_access() returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_service_admin();
$$;
revoke all on function public.service_admin_access() from public,anon;
grant execute on function public.service_admin_access() to authenticated;
commit;
