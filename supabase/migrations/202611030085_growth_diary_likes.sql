begin;
create table public.growth_diary_likes (
 record_id uuid not null references public.child_records(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(record_id,user_id)
);
create index growth_diary_likes_user on public.growth_diary_likes(user_id);
alter table public.growth_diary_likes enable row level security;
revoke all on public.growth_diary_likes from anon,authenticated;
grant all on public.growth_diary_likes to service_role;
create function public.growth_diary_reaction_allowed(p_record uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.child_records r where r.id=p_record and r.service='growth'
 and (public.can_read_child(r.child_id) or public.growth_diary_photo_allowed(r.id)));
$$;
create function public.growth_diary_reactions(p_records uuid[])
returns table(id uuid,likes bigint,liked boolean)
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.account_active() then raise exception 'forbidden' using errcode='42501';end if;
 if p_records is null or cardinality(p_records)>21 then raise exception 'invalid records' using errcode='22023';end if;
 return query select r.id,(select count(*) from public.growth_diary_likes l where l.record_id=r.id),
 exists(select 1 from public.growth_diary_likes l where l.record_id=r.id and l.user_id=auth.uid())
 from public.child_records r where r.id=any(p_records) and public.growth_diary_reaction_allowed(r.id);
end $$;
create function public.set_growth_diary_like(p_record uuid,p_liked boolean)
returns table(likes bigint,liked boolean)
language plpgsql security definer set search_path='' as $$ begin
 if not public.growth_diary_reaction_allowed(p_record) then raise exception 'forbidden' using errcode='42501';end if;
 if p_liked is null then raise exception 'invalid reaction' using errcode='22023';end if;
 if p_liked then
  insert into public.growth_diary_likes(record_id,user_id) values(p_record,auth.uid()) on conflict do nothing;
 else delete from public.growth_diary_likes where record_id=p_record and user_id=auth.uid();end if;
 return query select count(*),exists(select 1 from public.growth_diary_likes mine where mine.record_id=p_record and mine.user_id=auth.uid())
 from public.growth_diary_likes l where l.record_id=p_record;
end $$;
revoke all on function public.growth_diary_reaction_allowed(uuid),public.growth_diary_reactions(uuid[]),public.set_growth_diary_like(uuid,boolean) from public,anon;
grant execute on function public.growth_diary_reaction_allowed(uuid),public.growth_diary_reactions(uuid[]),public.set_growth_diary_like(uuid,boolean) to authenticated;
-- Reuse the existing link authorization for both the diary and its aggregate.
-- The public projection never includes who liked a diary.
drop function public.read_child_diary_link(text,integer);
create function public.read_child_diary_link(p_token text,p_page integer default 0)
returns table(id uuid,note text,recorded_date date,photo_ids uuid[],author_relationship text,likes bigint)
language sql stable security definer set search_path='' as $$
 select r.id,r.note,(r.occurred_at at time zone r.record_timezone)::date,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.sort_order,p.created_at,p.id),r.author_relationship::text,
 (select count(*) from public.growth_diary_likes l where l.record_id=r.id)
 from public.child_records r where r.id in(select public.child_diary_link_records(p_token))
 and p_page between 0 and 10000 order by r.occurred_at desc,r.id limit 21 offset least(greatest(p_page,0),10000)*20;
$$;
revoke all on function public.read_child_diary_link(text,integer) from public;
grant execute on function public.read_child_diary_link(text,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
