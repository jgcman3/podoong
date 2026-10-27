-- Private family milestone observations; CDC checklist content v1.
create table public.child_milestones (
 child_id uuid not null references public.children(id) on delete cascade,
 milestone_key text not null check(milestone_key in ('cdc-v1-2-head','cdc-v1-2-sounds','cdc-v1-2-toy','cdc-v1-2-smile','cdc-v1-4-steady','cdc-v1-4-coo','cdc-v1-4-hands','cdc-v1-4-attention','cdc-v1-6-roll','cdc-v1-6-turns','cdc-v1-6-reach','cdc-v1-6-familiar','cdc-v1-9-sit-up','cdc-v1-9-transfer','cdc-v1-9-rake','cdc-v1-9-sit','cdc-v1-9-babble','cdc-v1-9-arms','cdc-v1-9-hidden','cdc-v1-9-name','cdc-v1-12-stand','cdc-v1-12-parent','cdc-v1-12-container','cdc-v1-12-clap','cdc-v1-18-walk','cdc-v1-18-words','cdc-v1-18-imitate','cdc-v1-18-point','cdc-v1-24-kick','cdc-v1-24-phrase','cdc-v1-24-switch','cdc-v1-24-feelings','cdc-v1-36-clothes','cdc-v1-36-talk','cdc-v1-36-circle','cdc-v1-36-play','cdc-v1-48-catch','cdc-v1-48-sentence','cdc-v1-48-colors','cdc-v1-48-comfort','cdc-v1-60-chores','cdc-v1-60-story','cdc-v1-60-count','cdc-v1-60-turns')),
 achieved_at timestamptz not null default now(),
 recorded_by uuid references public.profiles(id) on delete set null,
 primary key(child_id,milestone_key)
);
alter table public.child_milestones enable row level security;
revoke all on public.child_milestones from anon,authenticated;
grant select on public.child_milestones to authenticated;
grant all on public.child_milestones to service_role;
create policy milestone_read on public.child_milestones for select to authenticated
 using(public.account_active() and public.can_read_child(child_id));
create function public.set_child_milestone(p_child uuid,p_key text,p_achieved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare fid uuid;
begin
 if not public.account_active() or not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_key is null or p_key not in ('cdc-v1-2-head','cdc-v1-2-sounds','cdc-v1-2-toy','cdc-v1-2-smile','cdc-v1-4-steady','cdc-v1-4-coo','cdc-v1-4-hands','cdc-v1-4-attention','cdc-v1-6-roll','cdc-v1-6-turns','cdc-v1-6-reach','cdc-v1-6-familiar','cdc-v1-9-sit-up','cdc-v1-9-transfer','cdc-v1-9-rake','cdc-v1-9-sit','cdc-v1-9-babble','cdc-v1-9-arms','cdc-v1-9-hidden','cdc-v1-9-name','cdc-v1-12-stand','cdc-v1-12-parent','cdc-v1-12-container','cdc-v1-12-clap','cdc-v1-18-walk','cdc-v1-18-words','cdc-v1-18-imitate','cdc-v1-18-point','cdc-v1-24-kick','cdc-v1-24-phrase','cdc-v1-24-switch','cdc-v1-24-feelings','cdc-v1-36-clothes','cdc-v1-36-talk','cdc-v1-36-circle','cdc-v1-36-play','cdc-v1-48-catch','cdc-v1-48-sentence','cdc-v1-48-colors','cdc-v1-48-comfort','cdc-v1-60-chores','cdc-v1-60-story','cdc-v1-60-count','cdc-v1-60-turns') or p_achieved is null then raise exception 'invalid milestone' using errcode='22023'; end if;
 select family_id into fid from public.children where id=p_child for update;
 if p_achieved then
  insert into public.child_milestones(child_id,milestone_key,recorded_by) values(p_child,p_key,auth.uid()) on conflict(child_id,milestone_key) do nothing;
 else delete from public.child_milestones where child_id=p_child and milestone_key=p_key;
 end if;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'milestone_updated',p_child);
end $$;
revoke all on function public.set_child_milestone(uuid,text,boolean) from public,anon;
grant execute on function public.set_child_milestone(uuid,text,boolean) to authenticated;

create or replace function public.export_child_data(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('format_version',4,'exported_at',now(),'timestamps','UTC ISO-8601',
 'child',(select to_jsonb(c)-'family_id' from public.children c where id=p_child),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by started_at,id) from public.care_records r where child_id=p_child),'[]'::jsonb),
 'child_records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by occurred_at,id) from public.child_records r where child_id=p_child),'[]'::jsonb),
 'child_photos',coalesce((select jsonb_agg(to_jsonb(p)-'uploaded_by'-'path' order by created_at,id) from public.child_record_photos p where child_id=p_child),'[]'::jsonb),
 'vaccinations',coalesce((select jsonb_agg(to_jsonb(v)-'created_by'-'updated_by' order by coalesce(completed_date,scheduled_date),id) from public.vaccination_records v where child_id=p_child),'[]'::jsonb),
 'milestones',coalesce((select jsonb_agg(to_jsonb(m)-'recorded_by' order by milestone_key) from public.child_milestones m where child_id=p_child),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'created_by'-'assignee_id' order by due_date,id) from public.tasks t where child_id=p_child),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)-'created_by' order by date,id) from public.events e where child_id=p_child),'[]'::jsonb));
end $$;
