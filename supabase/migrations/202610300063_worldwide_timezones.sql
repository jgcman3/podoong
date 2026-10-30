begin;
create function public.valid_iana_timezone(p_timezone text) returns boolean
language sql stable set search_path='' as $$
  select length(p_timezone)<=100
    and (p_timezone='UTC' or p_timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$')
    and exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone);
$$;
revoke all on function public.valid_iana_timezone(text) from public,anon;
grant execute on function public.valid_iana_timezone(text) to authenticated,service_role;
alter table public.profiles drop constraint valid_timezone;
alter table public.profiles add constraint valid_timezone check(public.valid_iana_timezone(timezone));
alter table public.child_meal_plans drop constraint child_meal_plans_timezone_check;
alter table public.child_meal_plans add constraint child_meal_plans_timezone_check check(public.valid_iana_timezone(timezone));
commit;
