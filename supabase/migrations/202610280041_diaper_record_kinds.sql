-- Preserve the selected feature: diaper contents do not become standalone stool records.
-- Existing dirty/mixed records retain their historical classification.
alter table public.child_records drop constraint child_record_shape;
alter table public.child_records add constraint child_record_shape check ((service='sleep' and kind in ('nap','night') and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null)
 or (service='diaper' and kind in ('wet','dirty','mixed','dry','diaper_dirty','diaper_mixed') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and (kind in ('dirty','mixed','diaper_dirty','diaper_mixed') or (stool_color is null and stool_texture is null)))
 or (service='growth' and kind='measurement' and ended_at is null and (height_cm is not null or weight_kg is not null or head_cm is not null) and stool_color is null and stool_texture is null)
 or (service='growth' and kind='observation' and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null) or (service='activity' and kind in ('bath','hospital','temperature','medication','snack','play','tummy') and ended_at is null and height_cm is null and weight_kg is null and head_cm is null and stool_color is null and stool_texture is null));
