-- Owner withdrawal deletes owned families and all their child data.
-- Existing confirmation, fresh-login, backend-permit and durable cleanup rules remain.
create or replace function public.request_account_deletion(p_permit uuid,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$ declare jid uuid; fid uuid; begin
 perform public.require_recent_login();
 if p_confirmation is distinct from 'DELETE ACCOUNT' then raise exception 'confirmation required' using errcode='22023'; end if;
 select id into jid from public.data_operation_jobs where user_id=auth.uid(); if jid is not null then return jid; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.data_deletion_permits where token=p_permit and user_id=auth.uid() and expires_at>now()) then raise exception 'backend_not_verified' using errcode='42501'; end if;
 for fid in select family_id from public.family_members where user_id=auth.uid() and role='owner' order by family_id loop
 perform 1 from public.families where id=fid for update;
 end loop;
 insert into public.community_photo_cleanup(path) select name from storage.objects where bucket_id='community-photos' and split_part(name,'/',1)=auth.uid()::text on conflict do nothing;
 insert into public.data_operation_jobs(user_id) values(auth.uid()) returning id into jid;
 insert into public.data_operation_history(job_id,status) values(jid,'pending');
 insert into public.audit_events(family_id,actor_id,action,subject_id) select family_id,auth.uid(),'account_deleted',auth.uid() from public.family_members where user_id=auth.uid();
 delete from public.families f where exists(select 1 from public.family_members m where m.family_id=f.id and m.user_id=auth.uid() and m.role='owner');
 delete from public.profiles where id=auth.uid();
 delete from public.data_deletion_permits where user_id=auth.uid(); return jid;
end $$;
