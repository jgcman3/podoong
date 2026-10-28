begin;
alter table public.child_records drop constraint child_record_shape;
alter table public.child_records add constraint child_record_shape check ((service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry','diaper_dirty','diaper_mixed') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed','diaper_dirty','diaper_mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null) or (service='activity' and kind in ('bath','hospital','temperature','medication','snack','play','tummy','daycare','kindergarten') and (ended_at is null or kind in ('daycare','kindergarten')) and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null));

alter table public.child_records drop constraint childcare_attendance_required;
alter table public.child_records add constraint childcare_legacy_attendance check(attendance_status is null or (service='activity' and kind in ('daycare','kindergarten') and attendance_status in ('arrival','departure') and ended_at is null));
create unique index one_childcare_stay on public.child_records(child_id,kind) where service='activity' and kind in ('daycare','kindergarten') and ended_at is null and attendance_status is null;
commit;
