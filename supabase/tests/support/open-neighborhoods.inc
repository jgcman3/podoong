-- Real qualifying families for tests of already-open boards; never bypass the guard.
do $$
declare home record; neighbor uuid; owner uuid; claims text:=current_setting('request.jwt.claims',true);
begin
 perform set_config('request.jwt.claims','{}',true);
 for home in select * from public.families where merged_into is null and nullif(residence_country_code,'') is not null and nullif(residence_city,'') is not null and nullif(residence_locality,'') is not null loop
  if not exists(select 1 from public.children where family_id=home.id) then
   insert into public.children(id,family_id,name,sex,birth_date) values(gen_random_uuid(),home.id,'Local fixture','female',current_date-100);
  end if;
  while public.neighborhood_family_count(home.id)<3 loop
   neighbor:=gen_random_uuid();owner:=gen_random_uuid();
   insert into auth.users(id) values(owner);
   insert into public.profiles(id,display_name,consented_at) values(owner,'Local fixture',now());
   insert into public.families(id,name,residence_country_code,residence_province,residence_city,residence_locality)
   values(neighbor,'Local fixture',home.residence_country_code,home.residence_province,home.residence_city,home.residence_locality);
   insert into public.family_members(family_id,user_id,role) values(neighbor,owner,'owner');
   insert into public.children(id,family_id,name,sex,birth_date) values(gen_random_uuid(),neighbor,'Local fixture','male',current_date-100);
  end loop;
 end loop;
 perform set_config('request.jwt.claims',coalesce(claims,'{}'),true);
end $$;
