begin;
-- Retire record links rather than silently widening their disclosure scope.
drop policy diary_link_storage_read on storage.objects;
drop function public.diary_link_photo_access(text);
drop function public.read_diary_link(text);
drop function public.manage_diary_link(uuid,text);
drop function public.diary_link_photo(text,uuid);
drop function public.diary_link_record(text);
drop table public.diary_links;
create table public.child_diary_links (
 child_id uuid primary key references public.children(id) on delete cascade,
 token text not null unique default encode(extensions.gen_random_bytes(32),'hex') check(token ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references public.profiles(id) on delete cascade
);
alter table public.child_diary_links enable row level security;
revoke all on public.child_diary_links from public,anon,authenticated;
create function public.manage_child_diary_link(p_child uuid,p_action text) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform 1 from public.children where id=p_child for update;
 if not found or not public.account_active() or not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action='revoke' then delete from public.child_diary_links where child_id=p_child; return null;
 elsif p_action in ('create','rotate') then
  if p_action='rotate' then delete from public.child_diary_links where child_id=p_child; end if;
  insert into public.child_diary_links(child_id,created_by) values(p_child,auth.uid()) on conflict(child_id) do nothing;
 elsif p_action is distinct from 'get' then raise exception 'invalid action' using errcode='22023'; end if;
 select token into result from public.child_diary_links where child_id=p_child;
 return result;
end $$;
create function public.diary_link_child(p_token text) returns uuid
language sql stable security definer set search_path='' as $$
 select c.id from public.child_diary_links l join public.children c on c.id=l.child_id
 where l.token=p_token
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=l.created_by)
 and exists(select 1 from public.family_members m where m.family_id=c.family_id and m.user_id=l.created_by
 and (m.role='owner' or (m.role='editor' and exists(select 1 from public.child_access a where a.child_id=c.id and a.user_id=l.created_by and a.role='editor'))));
$$;
create function public.child_diary_link_profile(p_token text) returns table(nickname text)
language sql stable security definer set search_path='' as $$
 select name from public.children where id=public.diary_link_child(p_token);
$$;
-- Reuse this predicate for both feed and image authorization. Never expose private,
-- moderated, future, or deleted-author entries through the image endpoint either.
create function public.child_diary_link_records(p_token text) returns setof uuid
language sql stable security definer set search_path='' as $$
 select r.id from public.child_records r join public.growth_diary_shares s on s.record_id=r.id
 where r.child_id=public.diary_link_child(p_token) and r.service='growth'
 and s.everyone and not s.hidden and r.occurred_at<=now()
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and exists(select 1 from public.profiles p where p.id=s.published_by and p.consented_at is not null);
$$;
create function public.read_child_diary_link(p_token text,p_page integer default 0)
returns table(id uuid,note text,recorded_date date,photo_ids uuid[])
language sql stable security definer set search_path='' as $$
 select r.id,r.note,(r.occurred_at at time zone r.record_timezone)::date,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.created_at,p.id)
 from public.child_records r where r.id in(select public.child_diary_link_records(p_token))
 and p_page between 0 and 10000
 order by r.occurred_at desc,r.id limit 21 offset least(greatest(p_page,0),10000)*20;
$$;
create function public.diary_link_photo(p_token text,p_photo uuid)
returns table(path text,content_type text)
language sql stable security definer set search_path='' as $$
 select p.path,p.content_type from public.child_record_photos p
 where p.id=p_photo and p.record_id in(select public.child_diary_link_records(p_token));
$$;
revoke all on function public.manage_child_diary_link(uuid,text) from public,anon;
grant execute on function public.manage_child_diary_link(uuid,text) to authenticated;
revoke all on function public.diary_link_child(text),public.child_diary_link_profile(text),public.child_diary_link_records(text),public.read_child_diary_link(text,integer),public.diary_link_photo(text,uuid) from public;
grant execute on function public.diary_link_child(text),public.child_diary_link_profile(text),public.child_diary_link_records(text),public.read_child_diary_link(text,integer),public.diary_link_photo(text,uuid) to anon,authenticated;
commit;
