begin;
create table public.neighborhood_openings(region text not null,feature text not null check(feature in ('boards','market','support')),opened_at timestamptz,primary key(region,feature));
create table public.neighborhood_requests(family_id uuid not null references public.families on delete cascade,feature text not null check(feature in ('boards','market','support')),region text not null,created_at timestamptz not null default now(),primary key(family_id,feature));
create table public.neighborhood_posts(id uuid primary key default gen_random_uuid(),region text not null,feature text not null check(feature in ('boards','market','support')),family_id uuid not null references public.families on delete cascade,author_id uuid references public.profiles on delete set null,title text not null check(length(trim(title)) between 1 and 100),body text not null check(length(trim(body)) between 1 and 3000),created_at timestamptz not null default now());
create index neighborhood_posts_recent on public.neighborhood_posts(region,feature,created_at desc,id);
alter table public.neighborhood_openings enable row level security;
alter table public.neighborhood_requests enable row level security;
alter table public.neighborhood_posts enable row level security;
revoke all on public.neighborhood_openings,public.neighborhood_requests,public.neighborhood_posts from public,anon,authenticated;
create function public.neighborhood_region(p_family uuid) returns text language sql stable security definer set search_path='' as $$
 select residence_country_code||':'||lower(trim(residence_city)) from public.families where id=p_family and residence_country_code is not null and nullif(trim(residence_city),'') is not null;
$$;
revoke all on function public.neighborhood_region(uuid) from public,anon,authenticated;
create function public.neighborhood_status(p_family uuid) returns table(feature text,families bigint,requested boolean,opened boolean) language plpgsql security definer set search_path='' as $$ declare r text; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 r:=public.neighborhood_region(p_family);
 return query select f.key,(select count(*) from public.neighborhood_requests v where v.region=r and v.feature=f.key and public.neighborhood_region(v.family_id)=r),exists(select 1 from public.neighborhood_requests v where v.family_id=p_family and v.region=r and v.feature=f.key),exists(select 1 from public.neighborhood_openings o where o.region=r and o.feature=f.key and o.opened_at is not null) from (values('boards'),('market'),('support')) f(key);
end $$;
create function public.request_neighborhood(p_family uuid,p_feature text) returns void language plpgsql security definer set search_path='' as $$ declare r text; n bigint; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_feature is null or p_feature not in ('boards','market','support') then raise exception 'invalid feature' using errcode='22023'; end if;
 r:=public.neighborhood_region(p_family); if r is null then raise exception 'residence_required' using errcode='22023'; end if;
 insert into public.neighborhood_openings(region,feature) values(r,p_feature) on conflict do nothing;
 perform 1 from public.neighborhood_openings where region=r and feature=p_feature for update;
 insert into public.neighborhood_requests(family_id,feature,region) values(p_family,p_feature,r) on conflict(family_id,feature) do update set region=excluded.region;
 select count(*) into n from public.neighborhood_requests v where v.region=r and v.feature=p_feature and public.neighborhood_region(v.family_id)=r;
 if n>=10 then update public.neighborhood_openings set opened_at=coalesce(opened_at,now()) where region=r and feature=p_feature; end if;
end $$;
create function public.neighborhood_feed(p_family uuid,p_feature text) returns table(id uuid,title text,body text,created_at timestamptz,mine boolean) language plpgsql security definer set search_path='' as $$ declare r text; begin
 if not public.account_active() or not exists(select 1 from public.family_members where family_id=p_family and user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 r:=public.neighborhood_region(p_family);
 if not exists(select 1 from public.neighborhood_openings where region=r and feature=p_feature and opened_at is not null) then raise exception 'not_open' using errcode='42501'; end if;
 return query select p.id,p.title,p.body,p.created_at,p.author_id=auth.uid() from public.neighborhood_posts p where p.region=r and p.feature=p_feature order by p.created_at desc,p.id limit 50;
end $$;
create function public.save_neighborhood_post(p_family uuid,p_feature text,p_title text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$ declare r text; pid uuid; begin
 perform 1 from public.neighborhood_feed(p_family,p_feature) limit 1;
 r:=public.neighborhood_region(p_family);
 insert into public.neighborhood_posts(region,feature,family_id,author_id,title,body) values(r,p_feature,p_family,auth.uid(),p_title,p_body) returning id into pid;
 return pid;
end $$;
revoke all on function public.neighborhood_status(uuid),public.request_neighborhood(uuid,text),public.neighborhood_feed(uuid,text),public.save_neighborhood_post(uuid,text,text,text) from public,anon;
grant execute on function public.neighborhood_status(uuid),public.request_neighborhood(uuid,text),public.neighborhood_feed(uuid,text),public.save_neighborhood_post(uuid,text,text,text) to authenticated;
commit;
