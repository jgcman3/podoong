begin;
-- Existing invitations have no reliable creation timestamp. Count newly created ones only.
alter table public.invitations add column created_at timestamptz;
alter table public.invitations alter column created_at set default now();
create index invitations_created_at_idx on public.invitations(created_at) where created_at is not null;

create table public.service_action_daily (
 day date not null,
 action text not null check(action in ('introduction_copy','introduction_share_attempt','moment_save_attempt','moment_share_attempt')),
 attempts bigint not null default 0 check(attempts>=0),
 primary key(day,action)
);
alter table public.service_action_daily enable row level security;
revoke all on public.service_action_daily from public,anon,authenticated;
create function public.record_service_action(p_action text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action is null or p_action not in ('introduction_copy','introduction_share_attempt','moment_save_attempt','moment_share_attempt') then raise exception 'invalid action' using errcode='22023'; end if;
 insert into public.service_action_daily(day,action,attempts) values((now() at time zone 'Asia/Seoul')::date,p_action,1)
 on conflict(day,action) do update set attempts=public.service_action_daily.attempts+1;
end $$;
revoke all on function public.record_service_action(text) from public,anon;
grant execute on function public.record_service_action(text) to authenticated;

create function public.admin_sharing_usage(p_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Seoul')::date; start_at timestamptz; end_at timestamptz;
begin
 perform public.require_service_admin();
 if p_days is null or p_days not in (7,14,28) then raise exception 'invalid period' using errcode='22023';end if;
 start_at:=((today-(p_days-1))::timestamp at time zone 'Asia/Seoul');
 end_at:=((today+1)::timestamp at time zone 'Asia/Seoul');
 return jsonb_build_object('invitations',(
  select jsonb_build_object('created',count(*),'accepted',count(*) filter(where accepted_at is not null),'pending',count(*) filter(where accepted_at is null and revoked_at is null and expires_at>now()))
  from public.invitations where created_at>=start_at and created_at<end_at
 ),'actions',(
  select jsonb_agg(jsonb_build_object('action',a.action,'attempts',coalesce(v.attempts,0)) order by a.position)
  from unnest(array['introduction_copy','introduction_share_attempt','moment_save_attempt','moment_share_attempt']) with ordinality a(action,position)
  left join (select action,sum(attempts) attempts from public.service_action_daily where day between today-(p_days-1) and today group by action) v using(action)
 ));
end $$;
revoke all on function public.admin_sharing_usage(integer) from public,anon;
grant execute on function public.admin_sharing_usage(integer) to authenticated;

drop function public.admin_neighborhoods();
create function public.admin_neighborhoods()
returns table(region text,families bigint,opened boolean,missing integer,opened_at timestamptz,reopenings integer,founders jsonb)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 return query with homes as materialized (
  select public.community_home_area(f.id) area from public.families f
  where f.merged_into is null and nullif(f.residence_country_code,'') is not null
   and nullif(f.residence_city,'') is not null and nullif(f.residence_locality,'') is not null
   and exists(select 1 from public.children c where c.family_id=f.id)
   and exists(select 1 from public.family_members m where m.family_id=f.id)
 ), regions as (
  select md5(h.area::text)::uuid region_key,
   concat_ws(' ',h.area->>'country',case when h.area->>'country'='KR' then h.area->>'district' else h.area->>'city' end,h.area->>'locality') label,
   count(*) n from homes h group by h.area
 ) select r.label,r.n,r.n>=3,greatest(0,3-r.n)::integer,o.opened_at,coalesce(greatest(o.opening_count-1,0),0),
  coalesce((select jsonb_agg(f.name order by f.position) from public.neighborhood_board_founders f where f.region_key=r.region_key),'[]'::jsonb)
 from regions r left join public.neighborhood_board_openings o on o.region_key=r.region_key
 order by r.n desc,r.label limit 100;
end $$;
revoke all on function public.admin_neighborhoods() from public,anon;
grant execute on function public.admin_neighborhoods() to authenticated;

create or replace function public.cleanup_service_usage() returns void language sql security definer set search_path='' as $$
 delete from public.service_usage_daily where day<(now() at time zone 'Asia/Seoul')::date-89;
 delete from public.service_action_daily where day<(now() at time zone 'Asia/Seoul')::date-89;
 delete from public.developer_requests r where r.status in ('done','closed')
 and greatest(r.created_at,coalesce((select d.updated_at from public.admin_request_details d where d.request_id=r.id),r.created_at))<now()-interval '180 days';
$$;
commit;
