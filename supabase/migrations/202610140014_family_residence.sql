alter table public.families
 add column residence_city text,
 add column residence_locality text,
 add column residence_version integer not null default 0 check(residence_version>=0),
 add column residence_updated_at timestamptz,
 add constraint family_residence_complete check(
  (residence_city is null and residence_locality is null) or
  (residence_city is not null and residence_locality is not null
   and length(btrim(residence_city)) between 1 and 100
   and length(btrim(residence_locality)) between 1 and 80
   and residence_city !~ '[[:cntrl:]]' and residence_locality !~ '[[:cntrl:]]')
 );
comment on column public.families.residence_city is 'Family-entered city / county / district label; not a verified administrative code.';
comment on column public.families.residence_locality is 'Family-entered dong / eup / myeon label; no street address is required.';
create function public.save_family_residence(p_family uuid,p_city text,p_locality text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare current_version integer; city text:=nullif(btrim(p_city),''); locality text:=nullif(btrim(p_locality),'');
begin
 if auth.uid() is null or not public.account_active() or not public.is_family_owner(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 select residence_version into current_version from public.families where id=p_family for update;
 if p_version is null or current_version is null or current_version<>p_version then raise exception 'conflict'; end if;
 update public.families set residence_city=city,residence_locality=locality,residence_version=residence_version+1,residence_updated_at=now() where id=p_family;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family,auth.uid(),'family_residence_saved',p_family);
end $$;
revoke all on function public.save_family_residence(uuid,text,text,integer) from public,anon;
grant execute on function public.save_family_residence(uuid,text,text,integer) to authenticated;
