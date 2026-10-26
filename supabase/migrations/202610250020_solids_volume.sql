-- New solids use volume. Historical gram measurements remain grams;
-- mass cannot be converted to volume without the food's density.
alter table public.care_records drop constraint care_record_amount_units;
alter table public.care_records add constraint care_record_amount_units check (
 (kind='solids' and (amount_ml is null or amount_g is null))
 or (kind in ('breast','formula') and amount_g is null)
);
