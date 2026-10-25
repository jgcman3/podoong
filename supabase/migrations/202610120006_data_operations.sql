-- Destructive requests require a verified server credential AND a fresh user login.
create function public.require_recent_login() returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method' in ('oauth','password') and (a->>'timestamp')::numeric between extract(epoch from clock_timestamp())-300 and extract(epoch from clock_timestamp())+30) then raise exception 'reauthenticate' using errcode='42501'; end if;
end $$;
do $$ declare r record; begin
 for r in select * from (values ('care_records','created_by'),('care_records','updated_by'),('tasks','created_by'),('events','created_by'),('invitations','created_by')) x(t,c) loop
 execute format('alter table public.%I alter column %I drop not null',r.t,r.c);
 execute format('alter table public.%I drop constraint %I',r.t,r.t||'_'||r.c||'_fkey');
 execute format('alter table public.%I add foreign key (%I) references public.profiles on delete set null',r.t,r.c);
 end loop;
end $$;
create table public.data_deletion_permits(token uuid primary key default gen_random_uuid(),user_id uuid not null,expires_at timestamptz not null default now()+interval '2 minutes');
create table public.data_operation_jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null unique,status text not null default 'pending' check(status in ('pending','processing','failed','complete')),attempts integer not null default 0,lease_token uuid,leased_until timestamptz,error_code text,created_at timestamptz not null default now(),completed_at timestamptz);
create table public.data_operation_history(id bigint generated always as identity primary key,job_id uuid references public.data_operation_jobs on delete cascade,status text not null,created_at timestamptz not null default now());
create function public.permit_account_deletion(p_user uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare v uuid; begin
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'unknown user'; end if;
 delete from public.data_deletion_permits where expires_at<now();
 insert into public.data_deletion_permits(user_id) values(p_user) returning token into v; return v;
end $$;
create function public.export_child_data(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('format_version',1,'exported_at',now(),'timestamps','UTC ISO-8601','child',(select to_jsonb(c)-'family_id' from public.children c where id=p_child),'records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by started_at,id) from public.care_records r where child_id=p_child),'[]'::jsonb),'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'created_by'-'assignee_id' order by due_date,id) from public.tasks t where child_id=p_child),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e)-'created_by' order by date,id) from public.events e where child_id=p_child),'[]'::jsonb));
end $$;
create function public.delete_child_data(p_child uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$ declare fid uuid; begin
 perform public.require_recent_login();
 if p_confirmation<>'DELETE CHILD' then raise exception 'confirmation required' using errcode='22023'; end if;
 select family_id into fid from public.children where id=p_child for update;
 if fid is null or not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'child_deleted',p_child);
 delete from public.children where id=p_child;
end $$;
create function public.transfer_family_ownership(p_family uuid,p_member uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.require_recent_login(); perform 1 from public.families where id=p_family for update;
 if p_confirmation<>'TRANSFER OWNER' or not public.is_family_owner(p_family) or p_member=auth.uid() or not exists(select 1 from public.family_members where family_id=p_family and user_id=p_member) then raise exception 'forbidden' using errcode='42501'; end if;
 update public.family_members set role='owner' where family_id=p_family and user_id=p_member;
 update public.family_members set role='editor' where family_id=p_family and user_id=auth.uid();
 insert into public.child_access(child_id,family_id,user_id,role) select id,p_family,auth.uid(),'editor' from public.children where family_id=p_family on conflict(child_id,user_id) do update set role='editor';
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family,auth.uid(),'ownership_transferred',p_member);
end $$;
create function public.request_account_deletion(p_permit uuid,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$ declare jid uuid; fid uuid; begin
 perform public.require_recent_login();
 if p_confirmation<>'DELETE ACCOUNT' then raise exception 'confirmation required' using errcode='22023'; end if;
 select id into jid from public.data_operation_jobs where user_id=auth.uid(); if jid is not null then return jid; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.data_deletion_permits where token=p_permit and user_id=auth.uid() and expires_at>now()) then raise exception 'backend_not_verified' using errcode='42501'; end if;
 for fid in select family_id from public.family_members where user_id=auth.uid() and role='owner' order by family_id loop
 perform 1 from public.families where id=fid for update;
 if not exists(select 1 from public.family_members where family_id=fid and role='owner' and user_id<>auth.uid()) and exists(select 1 from public.family_members where family_id=fid and user_id<>auth.uid()) then raise exception 'transfer ownership first' using errcode='23514'; end if;
 end loop;
 insert into public.community_photo_cleanup(path) select name from storage.objects where bucket_id='community-photos' and split_part(name,'/',1)=auth.uid()::text on conflict do nothing;
 insert into public.data_operation_jobs(user_id) values(auth.uid()) returning id into jid;
 insert into public.data_operation_history(job_id,status) values(jid,'pending');
 insert into public.audit_events(family_id,actor_id,action,subject_id) select family_id,auth.uid(),'account_deleted',auth.uid() from public.family_members where user_id=auth.uid();
 delete from public.families f where exists(select 1 from public.family_members m where m.family_id=f.id and m.user_id=auth.uid() and m.role='owner') and not exists(select 1 from public.family_members m where m.family_id=f.id and m.user_id<>auth.uid());
 delete from public.profiles where id=auth.uid();
 delete from public.data_deletion_permits where user_id=auth.uid(); return jid;
end $$;
create function public.claim_data_operation() returns public.data_operation_jobs language plpgsql security definer set search_path='' as $$ declare j public.data_operation_jobs; begin
 select * into j from public.data_operation_jobs where status in ('pending','failed','processing') and (leased_until is null or leased_until<now()) and attempts<10 order by created_at for update skip locked limit 1;
 if j.id is null then return null; end if;
 update public.data_operation_jobs set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),leased_until=now()+interval '5 minutes',error_code=null where id=j.id returning * into j;
 insert into public.data_operation_history(job_id,status) values(j.id,'processing'); return j;
end $$;
create function public.finish_data_operation(p_job uuid,p_lease uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.data_operation_jobs set status=case when p_success then 'complete' else 'failed' end,error_code=case when p_success then null else 'backend_retry_required' end,leased_until=case when p_success then null else now()+interval '5 minutes' end,completed_at=case when p_success then now() end where id=p_job and lease_token=p_lease and status='processing';
 if not found then raise exception 'lease lost'; end if;
 insert into public.data_operation_history(job_id,status) values(p_job,case when p_success then 'complete' else 'failed' end);
end $$;
create function public.queue_orphan_photos() returns integer language plpgsql security definer set search_path='' as $$ declare n integer; begin
 insert into public.community_photo_cleanup(path) select o.name from storage.objects o where bucket_id='community-photos' and created_at<now()-interval '24 hours' and not exists(select 1 from public.community_photos p where p.path=o.name) on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
create table public.usage_events(id bigint generated always as identity primary key,user_id uuid references public.profiles on delete cascade,family_id uuid references public.families on delete cascade,kind text not null check(kind in ('onboarding','record','task_complete','family_join','poll_vote')),occurred_at timestamptz not null default now());
create function public.capture_usage_event() returns trigger language plpgsql security definer set search_path='' as $$ declare uid uuid; fid uuid; k text; begin
 if tg_table_name='care_records' then uid:=new.created_by; select family_id into fid from public.children where id=new.child_id; k:='record';
 elsif tg_table_name='tasks' then if new.status<>'done' or old.status='done' then return new; end if; uid:=auth.uid(); select family_id into fid from public.children where id=new.child_id; k:='task_complete';
 elsif tg_table_name='family_members' then uid:=new.user_id; fid:=new.family_id; k:=case when new.role='owner' then 'onboarding' else 'family_join' end;
 else uid:=new.user_id; k:='poll_vote'; end if;
 if uid is not null then insert into public.usage_events(user_id,family_id,kind) values(uid,fid,k); end if; return new;
end $$;
create trigger usage_records after insert on public.care_records for each row execute function public.capture_usage_event();
create trigger usage_tasks after update on public.tasks for each row execute function public.capture_usage_event();
create trigger usage_members after insert on public.family_members for each row execute function public.capture_usage_event();
create trigger usage_polls after insert on public.daily_poll_votes for each row execute function public.capture_usage_event();
create function public.operation_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('window_days',28,'active_families',(select count(distinct family_id) from public.usage_events where occurred_at>=now()-interval '28 days'),'collaborating_families',(select count(*) from (select family_id from public.usage_events where occurred_at>=now()-interval '28 days' and family_id is not null group by family_id having count(distinct user_id)>1) x),'eligible_4week_users',(select count(*) from public.profiles where created_at<=now()-interval '35 days'),'retained_4week_users',(select count(distinct p.id) from public.profiles p join public.usage_events u on u.user_id=p.id and u.occurred_at>=p.created_at+interval '28 days' and u.occurred_at<p.created_at+interval '35 days' where p.created_at<=now()-interval '35 days'),'database_bytes',pg_database_size(current_database()),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects));
end $$;
do $$ declare t text; begin foreach t in array array['data_deletion_permits','data_operation_jobs','data_operation_history','usage_events'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); end loop; end $$;
grant select on public.data_operation_jobs,public.data_operation_history to authenticated;
create policy job_status on public.data_operation_jobs for select to authenticated using(user_id=auth.uid() or public.is_moderator());
create policy job_history on public.data_operation_history for select to authenticated using(exists(select 1 from public.data_operation_jobs j where j.id=job_id and (j.user_id=auth.uid() or public.is_moderator())));
revoke all on function public.require_recent_login(),public.permit_account_deletion(uuid),public.export_child_data(uuid),public.delete_child_data(uuid,text),public.transfer_family_ownership(uuid,uuid,text),public.request_account_deletion(uuid,text),public.claim_data_operation(),public.finish_data_operation(uuid,uuid,boolean),public.queue_orphan_photos(),public.capture_usage_event(),public.operation_metrics() from public,anon,authenticated;
grant execute on function public.export_child_data(uuid),public.delete_child_data(uuid,text),public.transfer_family_ownership(uuid,uuid,text),public.request_account_deletion(uuid,text),public.operation_metrics() to authenticated;
grant execute on function public.permit_account_deletion(uuid),public.claim_data_operation(),public.finish_data_operation(uuid,uuid,boolean),public.queue_orphan_photos() to service_role;
grant all on public.community_photo_cleanup,public.data_operation_jobs,public.data_operation_history to service_role;
create function public.account_has_storage(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from storage.objects where bucket_id='community-photos' and split_part(name,'/',1)=p_user::text); $$;
revoke all on function public.account_has_storage(uuid) from public,anon,authenticated;
grant execute on function public.account_has_storage(uuid) to service_role;

create function public.account_active() returns boolean language sql stable security definer set search_path='' as $$ select not exists(select 1 from public.data_operation_jobs where user_id=auth.uid()); $$;
revoke all on function public.account_active() from public,anon;
grant execute on function public.account_active() to authenticated;
alter policy own_profile_create on public.profiles with check(id=auth.uid() and public.account_active());
alter policy own_profile_update on public.profiles using(id=auth.uid() and public.account_active()) with check(id=auth.uid() and public.account_active());
