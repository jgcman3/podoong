-- Shared per-child schedules; caregivers see the same wall-clock times.
create function public.valid_meal_times(times text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(times) <= 3 and not exists (
    select 1 from unnest(times) t where t is null or t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
$$;
revoke all on function public.valid_meal_times(text[]) from public, anon;
grant execute on function public.valid_meal_times(text[]) to authenticated;

create table public.child_meal_plans (
  child_id uuid primary key references public.children(id) on delete cascade,
  feeding_minutes integer check(feeding_minutes between 30 and 1440),
  solids_times text[] not null default '{}' check(public.valid_meal_times(solids_times)),
  meal_times text[] not null default '{}' check(public.valid_meal_times(meal_times)),
  timezone text not null check(timezone in ('Asia/Seoul','UTC','America/New_York','Europe/London','Asia/Tokyo'))
);
alter table public.child_meal_plans enable row level security;
revoke all on public.child_meal_plans from anon, authenticated;
grant select, insert, update on public.child_meal_plans to authenticated;
create policy meal_plan_read on public.child_meal_plans for select to authenticated
  using(public.can_read_child(child_id));
create policy meal_plan_create on public.child_meal_plans for insert to authenticated
  with check(public.can_write_child(child_id));
create policy meal_plan_update on public.child_meal_plans for update to authenticated
  using(public.can_write_child(child_id)) with check(public.can_write_child(child_id));
