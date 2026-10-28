begin;
alter table public.child_record_photos add column sort_order integer not null default 0;
with ranked as (select id,row_number() over(partition by record_id order by created_at,id)-1 as n from public.child_record_photos)
update public.child_record_photos p set sort_order=ranked.n from ranked where p.id=ranked.id;
create or replace function public.add_child_record_photo(p_id uuid,p_record uuid,p_type text,p_size bigint) returns text language plpgsql security definer set search_path='' as $$
declare r public.child_records; object_path text; begin
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or r.service<>'growth' or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select count(*) from public.child_record_photos where record_id=p_record)>=9 then raise exception 'photo limit' using errcode='23514'; end if;
 object_path:=auth.uid()::text||'/'||r.child_id||'/'||r.id||'/'||p_id||case p_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
 insert into public.child_record_photos(id,record_id,child_id,path,content_type,size_bytes,uploaded_by,sort_order) values(p_id,r.id,r.child_id,object_path,p_type,p_size,auth.uid(),(select coalesce(max(sort_order)+1,0) from public.child_record_photos where record_id=p_record));
 return object_path;
end $$;

create function public.reorder_diary_photos(p_record uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare r public.child_records;
begin
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or r.service<>'growth' or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_ids is null or cardinality(p_ids)>9
 or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
 or cardinality(p_ids)<>(select count(*) from public.child_record_photos where record_id=p_record)
 or exists(select 1 from unnest(p_ids) requested(id) where not exists(select 1 from public.child_record_photos p where p.id=requested.id and p.record_id=p_record))
 then raise exception 'invalid photo order' using errcode='22023'; end if;
 update public.child_record_photos p set sort_order=o.n-1
 from unnest(p_ids) with ordinality o(id,n) where p.id=o.id and p.record_id=p_record;
end $$;
revoke all on function public.reorder_diary_photos(uuid,uuid[]) from public,anon;
grant execute on function public.reorder_diary_photos(uuid,uuid[]) to authenticated;
create or replace function public.growth_diary_feed(p_child uuid,p_scope text,p_page integer default 0,p_age integer default null)
returns table(id uuid,nickname text,age_days integer,sex text,note text,weight_kg numeric,height_cm numeric,head_cm numeric,photo_ids uuid[],recorded_date date)
language plpgsql stable security definer set search_path='' as $$
declare birthday date;
begin
 if not public.account_active() or not public.community_participant() or not public.can_read_child(p_child) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_scope not in ('birth','all') or p_scope is null or p_page is null or p_page<0 or p_page>10000 or p_age<0 then
  raise exception 'invalid feed' using errcode='22023';
 end if;
 select birth_date into birthday from public.children where children.id=p_child;
 return query select r.id,c.name,
 (r.occurred_at at time zone r.record_timezone)::date-c.birth_date,c.sex,r.note,
 case when p_scope='birth' then r.weight_kg end,
 case when p_scope='birth' then r.height_cm end,
 case when p_scope='birth' then r.head_cm end,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.sort_order,p.created_at,p.id),
 (r.occurred_at at time zone r.record_timezone)::date
 from public.growth_diary_shares s join public.child_records r on r.id=s.record_id
 join public.children c on c.id=r.child_id
 where not s.hidden and r.service='growth' and c.birth_date is not null
 and r.occurred_at<=now() and (r.occurred_at at time zone r.record_timezone)::date>=c.birth_date
 and public.community_author_visible(s.published_by)
 and not exists(select 1 from public.data_operation_jobs j where j.user_id=s.published_by)
 and ((p_scope='birth' and s.same_birth_date and c.birth_date=birthday) or (p_scope='all' and s.everyone))
 and (p_scope='all' or p_age is null or (r.occurred_at at time zone r.record_timezone)::date-c.birth_date=p_age)
 order by r.occurred_at desc,r.id limit 21 offset p_page*20;
end $$;
create or replace function public.read_child_diary_link(p_token text,p_page integer default 0)
returns table(id uuid,note text,recorded_date date,photo_ids uuid[])
language sql stable security definer set search_path='' as $$
 select r.id,r.note,(r.occurred_at at time zone r.record_timezone)::date,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.sort_order,p.created_at,p.id)
 from public.child_records r where r.id in(select public.child_diary_link_records(p_token))
 and p_page between 0 and 10000
 order by r.occurred_at desc,r.id limit 21 offset least(greatest(p_page,0),10000)*20;
$$;
commit;
