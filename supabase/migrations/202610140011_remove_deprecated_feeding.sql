-- Explicit product cleanup: permanently remove discontinued feeding types.
delete from public.notifications where kind='feeding' and reference_id in (
  select id from public.care_records where kind in ('pump','expressed','meal')
);
delete from public.care_records where kind in ('pump','expressed','meal');
alter table public.care_records drop constraint care_records_kind_check;
alter table public.care_records add constraint care_records_kind_check
  check(kind in ('breast','formula','solids'));
alter table public.care_records drop constraint care_record_amount_units;
alter table public.care_records add constraint care_record_amount_units check (
  (kind='solids' and amount_ml is null)
  or (kind in ('breast','formula') and amount_g is null)
);
alter table public.child_meal_plans drop column meal_times;

do $$ declare fn regprocedure; definition text; begin
  for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
    and proname in ('notification_valid','deliver_notifications_internal') loop
    definition := pg_get_functiondef(fn);
    execute replace(definition, '(''breast'',''formula'',''expressed'')', '(''breast'',''formula'')');
  end loop;
end $$;
