begin;
-- The virtual room is strictly the selected family's home locality. Keep the
-- existing signature for compatibility, but reject broader/browsing scopes.
create or replace function public.parenting_friends(p_family uuid,p_scope text default 'locality',p_place text default '',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,nickname text,status text,sex text,age_days integer,area_label text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare home public.families; today date; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_scope is distinct from 'locality' or p_place is distinct from '' then raise exception 'home locality only' using errcode='22023'; end if;
 select * into home from public.families where families.id=p_family;
 if home.merged_into is not null or nullif(home.residence_country_code,'') is null or nullif(home.residence_city,'') is null or nullif(home.residence_locality,'') is null then return; end if;
 select (now() at time zone timezone)::date into today from public.profiles where profiles.id=auth.uid();
 return query select p.id,p.nickname,p.status,c.sex,today-c.birth_date,home.residence_locality,p.created_at
 from public.parenting_friend_profiles p join public.children c on c.id=p.child_id join public.families f on f.id=c.family_id
 where p.enabled and f.merged_into is null and c.birth_date<=today and c.birth_date>(today-interval '7 years')::date
 and f.residence_country_code=home.residence_country_code and f.residence_city=home.residence_city and f.residence_locality=home.residence_locality
 and (home.residence_country_code='KR' or coalesce(f.residence_province,'')=coalesce(home.residence_province,''))
 and (p_before is null or p.created_at<p_before or (p.created_at=p_before and p.id<p_before_id))
 order by p.created_at desc,p.id desc limit 30;
end $$;
revoke all on function public.parenting_friends(uuid,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.parenting_friends(uuid,text,text,timestamptz,uuid) to authenticated;
commit;
