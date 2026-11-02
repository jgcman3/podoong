begin;
create table public.parenting_playground_reactions (
 id uuid primary key default gen_random_uuid(),
 sender_child uuid not null references public.children on delete cascade,
 receiver_child uuid not null references public.children on delete cascade,
 day date not null,
 kind text not null check(kind in ('wave','heart','comfort')),
 sender_name text not null,
 created_at timestamptz not null default now(),
 unique(sender_child,receiver_child,day,kind),
 check(sender_child<>receiver_child)
);
create index playground_received_reactions on public.parenting_playground_reactions(receiver_child,day,created_at desc,id desc);
create index playground_reactions_cleanup on public.parenting_playground_reactions(created_at);
alter table public.parenting_playground_reactions enable row level security;
revoke all on public.parenting_playground_reactions from public,anon,authenticated;
grant all on public.parenting_playground_reactions to service_role;

create function public.send_playground_reaction(p_child uuid,p_friend uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.children; f public.families; rid uuid; today date; target uuid; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('wave','heart','comfort') then raise exception 'invalid reaction' using errcode='22023'; end if;
 select * into c from public.children where id=p_child;
 select * into f from public.families where id=c.family_id and merged_into is null;
 rid:=public.playground_region(c.family_id);
 select (now() at time zone r.timezone)::date into today from public.parenting_playground_regions r where r.id=rid;
 if rid is null or f.id is null or c.birth_date>today or c.birth_date<=(today-interval '7 years')::date
 or not exists(select 1 from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child)
 then raise exception 'forbidden' using errcode='42501'; end if;
 select k.id into target from public.parenting_playground_positions s
 join public.children k on k.id=s.child_id join public.families cf on cf.id=k.family_id
 left join public.parenting_friend_profiles p on p.child_id=k.id
 where s.region_id=rid and s.day=today and k.id<>p_child
 and coalesce(p.id,md5(rid::text||k.id::text)::uuid)=p_friend
 and cf.merged_into is null and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date
 and cf.residence_country_code=f.residence_country_code and cf.residence_city=f.residence_city and cf.residence_locality=f.residence_locality
 and (f.residence_country_code='KR' or coalesce(cf.residence_province,'')=coalesce(f.residence_province,''));
 if target is null then raise exception 'friend unavailable' using errcode='22023'; end if;
 insert into public.parenting_playground_reactions(sender_child,receiver_child,day,kind,sender_name)
 values(p_child,target,today,p_kind,concat_ws(' ',trim(f.name),trim(c.name))) on conflict(sender_child,receiver_child,day,kind) do nothing;
 -- Lazy, bounded cleanup replaces a daily scheduler.
 delete from public.parenting_playground_reactions where id in
 (select id from public.parenting_playground_reactions where created_at<now()-interval '2 days' order by created_at limit 100);
end $$;
revoke all on function public.send_playground_reaction(uuid,uuid,text) from public,anon;
grant execute on function public.send_playground_reaction(uuid,uuid,text) to authenticated;

create function public.playground_reactions(p_child uuid,p_before uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rid uuid; today date; items jsonb; cursor_time timestamptz; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 select public.playground_region(c.family_id) into rid from public.children c where c.id=p_child;
 select (now() at time zone r.timezone)::date into today from public.parenting_playground_regions r where r.id=rid;
 today:=coalesce(today,(now() at time zone 'UTC')::date);
 if p_before is not null then
  select created_at into cursor_time from public.parenting_playground_reactions where id=p_before and receiver_child=p_child and day=today;
  if not found then return jsonb_build_object('day',today,'items','[]'::jsonb); end if;
 end if;
 select coalesce(jsonb_agg(a.item order by a.created_at desc,a.id desc),'[]'::jsonb) into items from (
  select id,created_at,jsonb_build_object('id',id,'name',sender_name,'kind',kind,'created_at',created_at) item
  from public.parenting_playground_reactions where receiver_child=p_child and day=today
  and (p_before is null or (created_at,id)<(cursor_time,p_before)) order by created_at desc,id desc limit 21
 ) a;
 return jsonb_build_object('day',today,'items',items);
end $$;
revoke all on function public.playground_reactions(uuid,uuid) from public,anon;
grant execute on function public.playground_reactions(uuid,uuid) to authenticated;
commit;
