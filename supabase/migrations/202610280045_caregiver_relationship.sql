begin;
create type public.caregiver_relationship as enum ('mother','father','grandmother','grandfather','maternal_aunt','paternal_aunt','maternal_uncle','paternal_uncle','maternal_aunt_husband','paternal_aunt_husband','uncle_wife','relative','guardian');
alter table public.family_members add column relationship public.caregiver_relationship;
alter table public.child_records add column author_relationship public.caregiver_relationship;
update public.family_members set relationship='father';
update public.child_records set author_relationship='father' where created_by is not null;


alter function public.create_family_with_child(text,text,date,text) rename to create_family_with_child_before_relationship;
revoke all on function public.create_family_with_child_before_relationship(text,text,date,text) from public,anon,authenticated;
create function public.create_family_with_child(p_family_name text,p_child_name text,p_birth_date date,p_sex text,p_relationship public.caregiver_relationship)
returns uuid language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
 cid := public.create_family_with_child_before_relationship(p_family_name,p_child_name,p_birth_date,p_sex);
 update public.family_members m set relationship=p_relationship from public.children c where c.id=cid and m.family_id=c.family_id and m.user_id=auth.uid();
 return cid;
end $$;
alter function public.accept_invitation(text) rename to accept_invitation_before_relationship;
revoke all on function public.accept_invitation_before_relationship(text) from public,anon,authenticated;
create function public.accept_invitation(p_token text,p_relationship public.caregiver_relationship) returns uuid language plpgsql security definer set search_path='' as $$ declare cid uuid; begin
 if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
 cid := public.accept_invitation_before_relationship(p_token);
 update public.family_members m set relationship=p_relationship from public.children c where c.id=cid and m.family_id=c.family_id and m.user_id=auth.uid();
 return cid;
end $$;
create function public.capture_diary_relationship() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if TG_OP='UPDATE' and old.author_relationship is not null then
  new.author_relationship := old.author_relationship;
 else
  select m.relationship into new.author_relationship from public.family_members m join public.children c on c.family_id=m.family_id where c.id=new.child_id and m.user_id=new.created_by;
 end if;
 return new;
end $$;
create trigger capture_diary_relationship before insert or update on public.child_records for each row execute function public.capture_diary_relationship();
create function public.set_caregiver_relationship(p_family uuid,p_relationship public.caregiver_relationship) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_relationship is null then raise exception 'relationship_required' using errcode='22023'; end if;
 if not public.account_active() or auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 update public.family_members set relationship=p_relationship where family_id=p_family and user_id=auth.uid();
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 -- Attribute older records only when their original author supplies the missing relationship.
 update public.child_records r set author_relationship=p_relationship from public.children c where r.child_id=c.id and c.family_id=p_family and r.created_by=auth.uid() and r.author_relationship is null;
end $$;
revoke all on function public.capture_diary_relationship(),public.set_caregiver_relationship(uuid,public.caregiver_relationship),public.create_family_with_child(text,text,date,text,public.caregiver_relationship),public.accept_invitation(text,public.caregiver_relationship) from public,anon;
grant execute on function public.set_caregiver_relationship(uuid,public.caregiver_relationship),public.create_family_with_child(text,text,date,text,public.caregiver_relationship),public.accept_invitation(text,public.caregiver_relationship) to authenticated;
drop function public.growth_diary_feed(uuid,text,integer,integer);
create function public.growth_diary_feed(p_child uuid,p_scope text,p_page integer default 0,p_age integer default null)
returns table(id uuid,nickname text,age_days integer,sex text,note text,weight_kg numeric,height_cm numeric,head_cm numeric,photo_ids uuid[],recorded_date date,author_relationship text)
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
 (r.occurred_at at time zone r.record_timezone)::date,r.author_relationship::text
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
drop function public.read_child_diary_link(text,integer);
create function public.read_child_diary_link(p_token text,p_page integer default 0)
returns table(id uuid,note text,recorded_date date,photo_ids uuid[],author_relationship text)
language sql stable security definer set search_path='' as $$
 select r.id,r.note,(r.occurred_at at time zone r.record_timezone)::date,
 array(select p.id from public.child_record_photos p where p.record_id=r.id order by p.sort_order,p.created_at,p.id),r.author_relationship::text
 from public.child_records r where r.id in(select public.child_diary_link_records(p_token))
 and p_page between 0 and 10000
 order by r.occurred_at desc,r.id limit 21 offset least(greatest(p_page,0),10000)*20;
$$;
revoke all on function public.growth_diary_feed(uuid,text,integer,integer),public.read_child_diary_link(text,integer) from public;
grant execute on function public.growth_diary_feed(uuid,text,integer,integer) to authenticated;
grant execute on function public.read_child_diary_link(text,integer) to anon,authenticated;
commit;
