begin;
alter table public.child_records drop constraint child_record_shape;
alter table public.child_records add constraint child_record_shape check (
 (service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry','diaper_dirty','diaper_mixed') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed','diaper_dirty','diaper_mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='activity' and kind in ('bath','hospital','temperature','medication','snack','play','tummy','daycare','kindergarten','gift','allowance','outing') and (ended_at is null or kind in ('daycare','kindergarten') or (kind in ('play','tummy','outing') and timer_started)) and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
);

alter table public.child_records drop constraint activity_timer_fields;
alter table public.child_records add constraint activity_timer_fields check(not timer_started or (service='activity' and kind in ('play','tummy','outing') and duration_minutes is null));
alter table public.child_records add constraint outing_timer_required check(kind <> 'outing' or timer_started);
commit;
