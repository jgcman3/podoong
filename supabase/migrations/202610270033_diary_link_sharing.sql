begin;
create table public.diary_links (
 record_id uuid primary key references public.child_records(id) on delete cascade,
 token text not null unique default encode(extensions.gen_random_bytes(32),'hex') check(token ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.diary_links enable row level security;
revoke all on public.diary_links from anon,authenticated;

create function public.manage_diary_link(p_record uuid,p_action text) returns text
language plpgsql security definer set search_path='' as $$
declare r public.child_records; result text;
begin
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or r.service<>'growth' or not public.account_active() or not public.can_write_child(r.child_id) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_action='revoke' then delete from public.diary_links where record_id=p_record; return null;
 elsif p_action='create' then
  insert into public.diary_links(record_id,created_by) values(p_record,auth.uid()) on conflict(record_id) do nothing;
 elsif p_action<>'get' or p_action is null then raise exception 'invalid action' using errcode='22023';
 end if;
 select token into result from public.diary_links where record_id=p_record;
 return result;
end $$;
revoke all on function public.manage_diary_link(uuid,text) from public,anon;
grant execute on function public.manage_diary_link(uuid,text) to authenticated;

-- A bearer link only exposes one diary, and stops working after revocation,
-- record/account deletion or loss of the issuing caregiver's write access.
create function public.diary_link_record(p_token text) returns uuid
language sql stable security definer set search_path='' as $$
 select r.id from public.diary_links l
 join public.child_records r on r.id=l.record_id
 join public.children c on c.id=r.child_id
 where l.token=p_token and r.service='growth'
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=l.created_by)
 and exists(select 1 from public.family_members m where m.family_id=c.family_id and m.user_id=l.created_by
  and (m.role='owner' or (m.role='editor' and exists(select 1 from public.child_access a where a.child_id=c.id and a.user_id=l.created_by and a.role='editor'))));
$$;
create function public.read_diary_link(p_token text)
returns table(nickname text,note text,recorded_date date,photo_ids uuid[])
language sql stable security definer set search_path='' as $$
 select c.name,r.note,(r.occurred_at at time zone r.record_timezone)::date,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.created_at,p.id)
 from public.child_records r join public.children c on c.id=r.child_id
 where r.id=public.diary_link_record(p_token);
$$;
create function public.diary_link_photo(p_token text,p_photo uuid)
returns table(path text,content_type text)
language sql stable security definer set search_path='' as $$
 select p.path,p.content_type from public.child_record_photos p
 where p.id=p_photo and p.record_id=public.diary_link_record(p_token);
$$;
create function public.diary_link_photo_access(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.child_record_photos p where p.path=p_path
 and p.record_id=public.diary_link_record(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-diary-link'));
$$;
revoke all on function public.diary_link_record(text),public.read_diary_link(text),public.diary_link_photo(text,uuid),public.diary_link_photo_access(text) from public;
grant execute on function public.diary_link_record(text),public.read_diary_link(text),public.diary_link_photo(text,uuid),public.diary_link_photo_access(text) to anon,authenticated;
create policy diary_link_storage_read on storage.objects for select to anon,authenticated
 using(bucket_id='child-care-photos' and storage.allow_only_operation('object.get_authenticated') and public.diary_link_photo_access(name));
commit;
