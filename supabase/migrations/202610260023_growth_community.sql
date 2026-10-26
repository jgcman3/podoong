-- Public projections never broaden access to private children or care records.
alter table public.children add column sex text check(sex in ('female','male'));
create table public.growth_diary_shares (
 record_id uuid primary key references public.child_records on delete cascade,
 same_birth_date boolean not null default false,
 everyone boolean not null default false,
 published_by uuid not null references public.profiles on delete cascade,
 updated_at timestamptz not null default now()
);
alter table public.growth_diary_shares enable row level security;
revoke all on public.growth_diary_shares from anon,authenticated;
grant select on public.growth_diary_shares to authenticated;
create policy growth_share_family_read on public.growth_diary_shares for select to authenticated
 using(exists(select 1 from public.child_records r where r.id=record_id and public.can_read_child(r.child_id)));

create function public.share_growth_diary(p_record uuid,p_same_birth_date boolean,p_everyone boolean,p_sex text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.child_records; c public.children;
begin
 select * into r from public.child_records where id=p_record;
 if r.id is null or r.service<>'growth' or not public.account_active() or not public.can_write_child(r.child_id) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select * into c from public.children where id=r.child_id for update;
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_same_birth_date or p_everyone then
  if not public.community_can_write() then raise exception 'forbidden' using errcode='42501'; end if;
  if c.birth_date is null or (r.occurred_at at time zone r.record_timezone)::date<c.birth_date or r.occurred_at>now() then
   raise exception 'birth date required' using errcode='22023';
  end if;
 end if;
 update public.children set sex=nullif(p_sex,'') where id=r.child_id;
 insert into public.growth_diary_shares(record_id,same_birth_date,everyone,published_by)
 values(p_record,p_same_birth_date,p_everyone,auth.uid())
 on conflict(record_id) do update set same_birth_date=excluded.same_birth_date,everyone=excluded.everyone,
 published_by=excluded.published_by,updated_at=now();
 insert into public.audit_events(family_id,actor_id,action,subject_id)
 values(c.family_id,auth.uid(),'growth_sharing_updated',r.id);
end $$;

create function public.growth_diary_feed(p_child uuid,p_scope text,p_page integer default 0)
returns table(id uuid,record_date date,age_days integer,sex text,title text,note text,weight_kg numeric,height_cm numeric,head_cm numeric,photo_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
declare birthday date;
begin
 if not public.account_active() or not public.community_participant() or not public.can_read_child(p_child) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_scope not in ('birth','all') or p_scope is null or p_page is null or p_page<0 or p_page>10000 then
  raise exception 'invalid feed' using errcode='22023';
 end if;
 select birth_date into birthday from public.children where children.id=p_child;
 return query select r.id,(r.occurred_at at time zone r.record_timezone)::date,
 (r.occurred_at at time zone r.record_timezone)::date-c.birth_date,c.sex,r.title,r.note,
 case when p_scope='birth' then r.weight_kg end,
 case when p_scope='birth' then r.height_cm end,
 case when p_scope='birth' then r.head_cm end,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.created_at,p.id)
 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and ((p_scope='birth' and s.same_birth_date and c.birth_date=birthday) or (p_scope='all' and s.everyone))
 order by r.occurred_at desc,r.id limit 21 offset p_page*20;
end $$;

-- Authorize a photo without exposing the private record, child or family row.
create function public.growth_diary_photo_allowed(p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and public.community_participant() and exists(
 select 1 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where s.record_id=p_record and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and (s.everyone or (s.same_birth_date and exists(
 select 1 from public.children viewer where viewer.birth_date=c.birth_date and public.can_read_child(viewer.id)))));
$$;
create function public.growth_diary_photo(p_id uuid) returns table(path text,content_type text)
language sql stable security definer set search_path='' as $$
 select p.path,p.content_type from public.child_record_photos p
 where p.id=p_id and public.growth_diary_photo_allowed(p.record_id);
$$;
create function public.growth_diary_photo_by_path(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.child_record_photos p where p.path=p_path and public.growth_diary_photo_allowed(p.record_id));
$$;
create policy growth_community_photo_read on storage.objects for select to authenticated
 using(bucket_id='child-care-photos' and storage.allow_only_operation('object.get_authenticated') and public.growth_diary_photo_by_path(name));
revoke all on function public.share_growth_diary(uuid,boolean,boolean,text),public.growth_diary_feed(uuid,text,integer),
 public.growth_diary_photo_allowed(uuid),public.growth_diary_photo(uuid),public.growth_diary_photo_by_path(text) from public,anon;
grant execute on function public.share_growth_diary(uuid,boolean,boolean,text),public.growth_diary_feed(uuid,text,integer),
 public.growth_diary_photo_allowed(uuid),public.growth_diary_photo(uuid),public.growth_diary_photo_by_path(text) to authenticated;
