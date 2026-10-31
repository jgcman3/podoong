begin;
-- Version 1 stores a 36px decorative inset; version 2 fills the entire icon.
-- Keep original files intact and remove the old inset only when serving v1.
alter table public.child_app_icons add column layout_version smallint not null default 1
  check(layout_version in (1,2));
commit;
