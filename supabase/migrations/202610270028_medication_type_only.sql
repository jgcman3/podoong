-- Allow medication type alone; preserve validation for existing explicit doses.
alter table public.child_records drop constraint activity_fields;
alter table public.child_records add constraint activity_fields check (
 (temperature_c is null or (service='activity' and kind='temperature' and temperature_c between 30 and 45))
 and (service<>'activity' or kind<>'temperature' or temperature_c is not null)
 and (length(medicine_name)<=200)
 and (kind='medication' or (medicine_name='' and dose_amount is null and dose_unit is null))
 and (kind<>'medication' or (length(trim(medicine_name))>0 and ((dose_amount is null and dose_unit is null) or (dose_amount is not null and dose_unit is not null and dose_amount>0 and dose_amount<=10000 and dose_unit in ('ml','mg','g','tablet','drop','packet')))))
 and (duration_minutes is null or (service='activity' and kind in ('bath','play','tummy') and duration_minutes between 1 and 1440))
);
