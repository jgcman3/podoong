-- Return names separately so child nicknames never compete with family names.
create or replace function public.parenting_playground(p_child uuid,p_left integer default null,p_right integer default null,p_day text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.children; f public.families; r public.parenting_playground_regions; own public.parenting_friend_profiles; pos public.parenting_playground_positions;
 today date; rid uuid; idx integer; col integer; lane integer; seed integer; lx integer; rx integer; lo integer; hi integer; n integer; members jsonb; begin
 if not public.account_active() or not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not public.child_privacy_allowed(p_child,'neighborhood') then raise exception 'neighborhood_consent_required' using errcode='42501'; end if;
 if (p_left is null)<>(p_right is null) or (p_left is not null and (abs(p_left::bigint)>100000000 or abs(p_right::bigint)>100000000 or p_right<p_left or p_right::bigint-p_left>4096)) then raise exception 'invalid viewport' using errcode='22023'; end if;
 select * into c from public.children where id=p_child; select * into f from public.families where id=c.family_id;
 rid:=public.playground_region(f.id); select * into own from public.parenting_friend_profiles where child_id=p_child;
 if rid is null then
  return jsonb_build_object('day',(now() at time zone 'UTC')::date,'timezone','UTC','expires_at',((date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC'),
   'width',680,'min_x',-340,'max_x',340,'height',520,'population',1,'left',-340,'right',340,
   'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'family_name',trim(f.name),'child_name',trim(c.name),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,current_date-c.birth_date),'x',0,'y',355),'members','[]'::jsonb);
 end if;
 select * into r from public.parenting_playground_regions where id=rid; today:=(now() at time zone r.timezone)::date;
 select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
 if not found and c.birth_date<=today and c.birth_date>(today-interval '7 years')::date then
  -- Serialize first arrivals per neighborhood/day. Existing rows are never moved.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rid::text||today::text,0));
  select * into pos from public.parenting_playground_positions where region_id=rid and day=today and child_id=p_child;
  if not found then
   select coalesce(max(slot)+1,0) into idx from public.parenting_playground_positions where region_id=rid and day=today;
   col:=idx/3; col:=case when col%2=1 then (col+1)/2*240 else -col/2*240 end; lane:=idx%3;
   seed:=('x'||substr(md5(rid::text||today::text||p_child::text),1,7))::bit(28)::integer;
   insert into public.parenting_playground_positions(region_id,day,child_id,slot,x,y)
    values(rid,today,p_child,idx,col+case lane when 1 then -55 when 2 then 55 else 0 end+seed%49-24,
    case lane when 1 then 275 when 2 then 435 else 355 end+(seed/53)%23-11) returning * into pos;
   -- Opportunistic bounded cleanup: no scheduled task or full-table sweep.
   delete from public.parenting_playground_positions where (region_id,day,child_id) in
    (select region_id,day,child_id from public.parenting_playground_positions where created_at<now()-interval '8 days' order by created_at limit 100);
  end if;
 end if;
 select least(-340,coalesce(min(x),0)-160),greatest(340,coalesce(max(x),0)+160) into lo,hi from public.parenting_playground_positions where region_id=rid and day=today and public.child_privacy_allowed(child_id,'neighborhood');
 select count(*) into n from public.parenting_playground_positions s join public.children k on k.id=s.child_id join public.families cf on cf.id=k.family_id
 where public.child_privacy_allowed(k.id,'neighborhood') and s.region_id=rid and s.day=today and cf.merged_into is null and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date
 and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province);
 lx:=case when p_day=today::text and p_left is not null then p_left else coalesce(pos.x,0)-1000 end;
 rx:=case when p_day=today::text and p_right is not null then p_right else coalesce(pos.x,0)+1000 end;
 select coalesce(jsonb_agg(a.item order by a.y,a.id),'[]'::jsonb) into members from (
  select coalesce(p.id,md5(rid::text||k.id::text)::uuid) id,s.y,jsonb_build_object('id',coalesce(p.id,md5(rid::text||k.id::text)::uuid),'nickname',concat_ws(' ',trim(cf.name),trim(k.name)),'family_name',trim(cf.name),'child_name',trim(k.name),'status',coalesce(p.status,''),'sex',k.sex,'age_days',today-k.birth_date,'x',s.x,'y',s.y) item
  from public.parenting_playground_positions s join public.children k on k.id=s.child_id left join public.parenting_friend_profiles p on p.child_id=k.id join public.families cf on cf.id=k.family_id
  where public.child_privacy_allowed(k.id,'neighborhood') and s.region_id=rid and s.day=today and s.x between lx and rx and k.id<>p_child
  and k.birth_date<=today and k.birth_date>(today-interval '7 years')::date and cf.merged_into is null
  and cf.residence_country_code=r.country and cf.residence_city=r.city and cf.residence_locality=r.locality and (r.country='KR' or coalesce(cf.residence_province,'')=r.province)
  order by s.x,s.child_id limit 150
 ) a;
 return jsonb_build_object('day',today,'timezone',r.timezone,'expires_at',(today+1)::timestamp at time zone r.timezone,
 'width',hi-lo,'min_x',lo,'max_x',hi,'height',520,'population',n,'left',lx,'right',rx,
 'own',jsonb_build_object('id','own-'||c.id,'nickname',concat_ws(' ',trim(f.name),trim(c.name)),'family_name',trim(f.name),'child_name',trim(c.name),'status',coalesce(own.status,''),'sex',c.sex,'age_days',greatest(0,today-c.birth_date),'x',coalesce(pos.x,0),'y',coalesce(pos.y,355)), 'members',members);
end $$;
