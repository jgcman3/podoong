begin;
-- Only processed app icons are reachable via an unguessable installation URL.
-- Originals are never retained. Child deletion/replacement revokes the URL.
create table public.child_app_icons (
  child_id uuid primary key references public.children(id) on delete cascade,
  token text not null unique check(token ~ '^[a-f0-9]{64}$'),
  path text not null unique check(path = 'app-icons/' || token || '.png'),
  created_at timestamptz not null default now()
);
alter table public.child_app_icons enable row level security;
create policy child_app_icon_read on public.child_app_icons for select to authenticated
  using(public.can_read_child(child_id));
-- Uploads are performed by the server only, after checking family ownership.
revoke all on public.child_app_icons from anon,authenticated;
grant select on public.child_app_icons to authenticated;
grant all on public.child_app_icons to service_role;
create function public.queue_app_icon_delete() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  insert into public.child_photo_cleanup(path) values(old.path) on conflict do nothing;
  return old;
end $$;
create trigger app_icon_deleted after delete on public.child_app_icons
  for each row execute function public.queue_app_icon_delete();
create trigger app_icon_replaced after update on public.child_app_icons
  for each row when(old.path is distinct from new.path) execute function public.queue_app_icon_delete();
revoke all on function public.queue_app_icon_delete() from public,anon,authenticated;
create or replace function public.queue_orphan_photos() returns integer
language plpgsql security definer set search_path='' as $$ declare n integer; m integer; begin
  insert into public.community_photo_cleanup(path)
    select o.name from storage.objects o where bucket_id='community-photos'
      and created_at<now()-interval '24 hours'
      and not exists(select 1 from public.community_photos p where p.path=o.name) on conflict do nothing;
  get diagnostics n=row_count;
  insert into public.child_photo_cleanup(path)
    select o.name from storage.objects o where bucket_id='child-care-photos'
      and created_at<now()-interval '24 hours'
      and not exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(o.name))
      and not exists(select 1 from public.child_app_icons i where i.path=o.name) on conflict do nothing;
  get diagnostics m=row_count; return n+m;
end $$;
commit;
