-- Expose the diary day in its recorded timezone, without publishing timestamps.
begin;
drop function public.growth_diary_feed(uuid,text,integer,integer);
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
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.created_at,p.id),
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


revoke all on function public.growth_diary_feed(uuid,text,integer,integer) from public,anon;
grant execute on function public.growth_diary_feed(uuid,text,integer,integer) to authenticated;
commit;
