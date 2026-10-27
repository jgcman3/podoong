create or replace function public.add_child_record_photo(p_id uuid,p_record uuid,p_type text,p_size bigint) returns text language plpgsql security definer set search_path='' as $$
declare r public.child_records; object_path text; begin
 select * into r from public.child_records where id=p_record for update;
 if r.id is null or r.service<>'growth' or not public.can_write_child(r.child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if (select count(*) from public.child_record_photos where record_id=p_record)>=5 then raise exception 'photo limit' using errcode='23514'; end if;
 object_path:=auth.uid()::text||'/'||r.child_id||'/'||r.id||'/'||p_id||case p_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
 insert into public.child_record_photos(id,record_id,child_id,path,content_type,size_bytes,uploaded_by) values(p_id,r.id,r.child_id,object_path,p_type,p_size,auth.uid());
 return object_path;
end $$;
