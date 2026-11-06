begin;

drop view public.calendar_entries;

drop function if exists public.my_schedule_items(date);

drop function if exists public.claim_schedule_push(text);

drop function if exists public.validate_schedule_push(uuid,uuid);

drop function if exists public.finish_schedule_push(uuid,uuid,text);

drop function if exists public.morning_push_candidates(timestamptz,uuid);

drop function if exists public.morning_push_at(uuid,date,text);

drop function if exists public.schedule_items(uuid,date);

drop function if exists public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text,boolean);

drop function if exists public.save_notification_preferences(boolean,boolean,boolean,time,time,integer,integer,integer,integer);

drop function if exists public.save_task(uuid,uuid,text,text,date,text,uuid);

drop function if exists public.save_event(uuid,uuid,text,date,text);

drop function if exists public.save_calendar_event(uuid,uuid,text,date,text,text,text,text);

drop function if exists public.delete_calendar_item(uuid,text);

drop function if exists public.preview_child_dates(uuid,date,date);

drop function if exists public.update_child_dates(uuid,date,date);

drop table public.schedule_push_deliveries;

create or replace function public.notification_valid(p_notification public.notifications) returns boolean language sql stable security definer set search_path='' as $$
 select p_notification.cancelled_at is null and public.notification_child_access(p_notification.recipient_id,p_notification.child_id)
 and p_notification.kind='feeding'
 and exists(select 1 from public.notification_preferences p where p.user_id=p_notification.recipient_id and p.feeding_enabled and exists(select 1 from public.care_records r where r.id=p_notification.reference_id and r.child_id=p_notification.child_id and r.kind in ('breast','formula') and r.ended_at is not null and not exists(select 1 from public.care_records newer where newer.child_id=r.child_id and newer.kind in ('breast','formula') and (newer.started_at>r.started_at or (newer.started_at=r.started_at and newer.id>r.id))) and p_notification.scheduled_at=r.ended_at+make_interval(mins=>p.feeding_interval_minutes)) );
$$;

create or replace function public.deliver_notifications_internal(p_user uuid) returns integer language plpgsql security definer set search_path='' as $$
declare prefs public.notification_preferences; zone text; local_now timestamp; current_clock timestamptz:=clock_timestamp(); delivered integer:=0;
begin
 select * into prefs from public.notification_preferences where user_id=p_user for update;
 if not found then return 0; end if;
 select timezone into zone from public.profiles where id=p_user and consented_at is not null;
 if not found then return 0; end if;
 local_now:=current_clock at time zone zone;
 insert into public.notifications(recipient_id,child_id,kind,reference_id,dedupe_key,scheduled_at)
 select p_user,r.child_id,'feeding',r.id,'feeding:'||r.id||':'||prefs.feeding_interval_minutes,r.ended_at+make_interval(mins=>prefs.feeding_interval_minutes)
 from public.care_records r where prefs.feeding_enabled and r.kind in ('breast','formula') and r.ended_at is not null and public.notification_child_access(p_user,r.child_id)
 and not exists(select 1 from public.care_records newer where newer.child_id=r.child_id and newer.kind in ('breast','formula') and (newer.started_at>r.started_at or (newer.started_at=r.started_at and newer.id>r.id)))
 on conflict(recipient_id,dedupe_key) do update set scheduled_at=excluded.scheduled_at,cancelled_at=null where notifications.delivered_at is null and (notifications.scheduled_at is distinct from excluded.scheduled_at or notifications.cancelled_at is not null);
 update public.notifications n set cancelled_at=current_clock where recipient_id=p_user and cancelled_at is null and (not public.notification_valid(n));
 if prefs.snooze_until>current_clock or public.notification_quiet(prefs.quiet_start,prefs.quiet_end,local_now::time) then return 0; end if;
 if exists(select 1 from public.notifications where recipient_id=p_user and delivered_at>current_clock-make_interval(mins=>prefs.frequency_minutes)) then return 0; end if;
 update public.notifications n set delivered_at=current_clock where recipient_id=p_user and delivered_at is null and scheduled_at<=current_clock and public.notification_valid(n);
 get diagnostics delivered=row_count; return delivered;
end $$;

create or replace function public.save_feeding_push_preferences(p_enabled boolean,p_interval integer,p_quiet boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.account_active() or not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_enabled is null or p_quiet is null or p_interval is null or p_interval not between 30 and 1440 then raise exception 'invalid interval' using errcode='22023'; end if;
 insert into public.notification_preferences(user_id,feeding_enabled,feeding_interval_minutes,quiet_start,quiet_end)
 values(auth.uid(),p_enabled,p_interval,case when p_quiet then '22:00'::time else '00:00'::time end,case when p_quiet then '07:00'::time else '00:00'::time end)
 on conflict(user_id) do update set feeding_enabled=excluded.feeding_enabled,feeding_interval_minutes=excluded.feeding_interval_minutes,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,snooze_until=null;
end $$;

create function public.save_push_settings(p_mode text,p_interval integer,p_quiet boolean,p_playground boolean,p_playground_quiet boolean,p_subscription jsonb default null,p_locale text default 'ko') returns uuid
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if p_playground is null or p_playground_quiet is null or p_locale is null or p_locale not in ('ko','en') then raise exception 'invalid preferences' using errcode='22023'; end if;
 perform public.save_feeding_reminder(p_mode,p_interval,p_quiet,null,p_locale);
 update public.notification_preferences set playground_enabled=p_playground,playground_quiet=p_playground_quiet,
 playground_enabled_at=case when p_playground and not playground_enabled then now() else playground_enabled_at end where user_id=auth.uid();
 if p_subscription is not null then
  if p_mode='off' and not p_playground then raise exception 'disabled mode' using errcode='22023'; end if;
  device:=public.register_feeding_push(p_subscription->>'endpoint',p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth',p_locale);
 end if;
 return device;
end $$;

revoke all on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text) from public,anon;
grant execute on function public.save_push_settings(text,integer,boolean,boolean,boolean,jsonb,text) to authenticated;

create or replace function public.dispatch_feeding_push() returns void language plpgsql security definer set search_path='' as $$
declare config public.feeding_push_config; token text;
begin
 delete from public.feeding_push_deliveries where scheduled_at<now()-interval '30 days';
 delete from public.playground_push_deliveries where scheduled_at<now()-interval '2 days';
 if not exists(select 1 from public.feeding_push_candidates() c
 join public.web_push_subscriptions s on s.id=c.subscription_id join public.notification_preferences p on p.user_id=s.user_id
 where not exists(select 1 from public.feeding_push_deliveries d where d.subscription_id=c.subscription_id and d.record_id=c.record_id and d.reference=p.feeding_reference and (d.status in ('sent','failed') or (d.status='cancelled' and d.scheduled_at=c.scheduled_at) or (d.status='sending' and d.leased_until>now()))))
 and not exists(select 1 from public.playground_push_deliveries d where d.attempts<3 and d.scheduled_at<=now()
 and (d.status='pending' or (d.status='sending' and d.leased_until<now()))) then return; end if;
 select * into config from public.feeding_push_config;
 if not found then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.token_secret_id;
 perform net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-podung-worker-token',token),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;

delete from public.notifications where kind in ('task','event');
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind='feeding');
alter table public.notification_preferences drop column task_enabled,drop column event_enabled,drop column delivery_hour,drop column schedule_enabled,drop column schedule_enabled_at;

create or replace function public.revoke_member(p_family_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) or p_user_id=auth.uid() then raise exception 'forbidden' using errcode='42501'; end if;
  delete from public.family_members where family_id=p_family_id and user_id=p_user_id and role<>'owner';
  if found then
    insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family_id,auth.uid(),'member_revoked',p_user_id);
  end if;
end $$;

create or replace function public.export_child_data(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 if not public.can_read_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('format_version',5,'exported_at',now(),'timestamps','UTC ISO-8601',
 'child',(select to_jsonb(c)-'family_id' from public.children c where id=p_child),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by started_at,id) from public.care_records r where child_id=p_child),'[]'::jsonb),
 'child_records',coalesce((select jsonb_agg(to_jsonb(r)-'created_by'-'updated_by' order by occurred_at,id) from public.child_records r where child_id=p_child),'[]'::jsonb),
 'child_photos',coalesce((select jsonb_agg(to_jsonb(p)-'uploaded_by'-'path' order by created_at,id) from public.child_record_photos p where child_id=p_child),'[]'::jsonb),
 'vaccinations',coalesce((select jsonb_agg(to_jsonb(v)-'created_by'-'updated_by' order by completed_date,id) from public.vaccination_records v where child_id=p_child),'[]'::jsonb),
 'milestones',coalesce((select jsonb_agg(to_jsonb(m)-'recorded_by' order by milestone_key) from public.child_milestones m where child_id=p_child),'[]'::jsonb));
end $$;

create or replace function public.update_health_consent(p_health boolean,p_confirmation text default '') returns void
language plpgsql security definer set search_path='' as $$
declare c public.signup_privacy_choices; owned uuid[]; begin
 if not public.has_signup_agreement() or not public.guardian_declared(auth.uid()) then raise exception 'authority_declaration_required' using errcode='42501'; end if;
 if p_health is null then raise exception 'invalid privacy choices' using errcode='22023'; end if;
 select * into c from public.signup_privacy_choices where user_id=auth.uid() for update;
 select coalesce(array_agg(g.child_id),'{}') into owned from public.child_privacy_consents g
 join public.children k on k.id=g.child_id join public.family_members m on m.family_id=k.family_id and m.user_id=g.accepted_by
 where g.accepted_by=auth.uid() and g.version=c.version and g.withdrawn_at is null and public.can_write_child(k.id);
 if c.health and not p_health and (
 exists(select 1 from public.child_records r where r.child_id=any(owned) and public.child_record_contains_health(r))
 or exists(select 1 from public.vaccination_records where child_id=any(owned))) then
  if p_confirmation is distinct from 'DELETE HEALTH RECORDS' then raise exception 'health_records_confirmation_required' using errcode='22023'; end if;
  perform public.require_recent_login();
  -- Keep a diary's text and photographs; withdraw only its structured measurements.
  update public.child_records set kind='observation',weight_kg=null,height_cm=null,head_cm=null
  where child_id=any(owned) and service='growth' and (weight_kg is not null or height_cm is not null or head_cm is not null);
  delete from public.child_records r where r.child_id=any(owned) and r.service<>'growth' and public.child_record_contains_health(r);
  delete from public.vaccination_records where child_id=any(owned);
 end if;
 update public.signup_privacy_choices set health=p_health,updated_at=clock_timestamp() where user_id=auth.uid();
 update public.child_privacy_consents set health=p_health where accepted_by=auth.uid() and version=c.version and withdrawn_at is null;
end $$;

create or replace function public.require_child_privacy() returns trigger
language plpgsql security definer set search_path='' as $$
declare child uuid; health boolean:=false; data jsonb:=to_jsonb(new); begin
 -- Trusted service imports may store fixtures but never manufacture acceptance evidence.
 if auth.role()='service_role' or auth.uid() is null then return new; end if;
 if tg_table_name='children' then
  if tg_op='INSERT' then
   if not public.guardian_declared(auth.uid()) then raise exception 'authority_declaration_required' using errcode='42501'; end if;
   return new;
  end if;
  child:=new.id;
 else child:=(data->>'child_id')::uuid; end if;
 if not public.child_privacy_allowed(child,'child') then raise exception 'child_consent_required' using errcode='42501'; end if;
 if tg_table_name='child_records' then health:=public.child_record_contains_health(new);
 elsif tg_table_name='vaccination_records' then health:=true;
 end if;
 if health and not public.child_privacy_allowed(child,'health') then raise exception 'health_consent_required' using errcode='42501'; end if;
 return new;
end $$;

delete from public.audit_events where action in ('task_saved','task_deleted','event_saved','event_deleted') or subject_id in (select id from public.tasks union select id from public.events union select id from public.vaccination_records where status<>'completed');
drop table public.tasks,public.events;

delete from public.vaccination_records where status<>'completed';
alter table public.vaccination_records drop column status,drop column scheduled_date;
alter table public.vaccination_records alter column completed_date set not null;
create index vaccination_child_completed_date on public.vaccination_records(child_id,completed_date,id);

create or replace function public.save_vaccination_record(p_id uuid,p_child uuid,p_data jsonb,p_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare old public.vaccination_records; fid uuid; tz text:=p_data->>'timezone';
begin
 if p_data ? 'status' or p_data ? 'scheduled_date' or nullif(p_data->>'completed_date','') is null then raise exception 'completed date required' using errcode='22023'; end if;
 if not public.can_write_child(p_child) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'invalid timezone' using errcode='22023'; end if;
 if nullif(p_data->>'completed_date','')::date>(now() at time zone tz)::date then raise exception 'future completion' using errcode='22023'; end if;
 perform 1 from public.children where id=p_child for update;
 select * into old from public.vaccination_records where id=p_id for update;
 if old.id is not null then
  if old.child_id<>p_child then raise exception 'forbidden' using errcode='42501'; end if;
  if p_version is null then
   if old.created_by=auth.uid() then return p_id; end if;
   raise exception 'conflict';
  end if;
  if old.version<>p_version then raise exception 'conflict'; end if;
 elsif p_version is not null then raise exception 'conflict'; end if;
 insert into public.vaccination_records(id,child_id,vaccine,custom_name,dose,season,completed_date,clinic,note,record_timezone,created_by,updated_by)
 values(p_id,p_child,p_data->>'vaccine',case when p_data->>'vaccine'='other' then coalesce(p_data->>'custom_name','') else '' end,
 nullif(p_data->>'dose','')::int,case when p_data->>'vaccine'='influenza' then nullif(p_data->>'season','') else null end,
 nullif(p_data->>'completed_date','')::date,
 coalesce(p_data->>'clinic',''),coalesce(p_data->>'note',''),tz,auth.uid(),auth.uid())
 on conflict(id) do update set vaccine=excluded.vaccine,custom_name=excluded.custom_name,dose=excluded.dose,season=excluded.season,
 completed_date=excluded.completed_date,clinic=excluded.clinic,note=excluded.note,record_timezone=excluded.record_timezone,
 updated_by=auth.uid(),updated_at=now(),version=vaccination_records.version+1;
 select family_id into fid from public.children where id=p_child;
 insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'vaccination_saved',p_id);
 return p_id;
end $$;

delete from public.moderation_actions where subject_id in
 (select id from public.community_posts union select id from public.community_comments union select id from public.neighborhood_posts where audience='country');
delete from public.community_posts;
delete from public.neighborhood_posts where audience='country';

delete from public.community_reports where post_id is not null or comment_id is not null;
alter table public.community_reports drop constraint report_single_subject;
alter table public.community_reports drop column post_id,drop column comment_id;
alter table public.community_reports add constraint report_single_subject check(num_nonnulls(diary_record_id,parenting_post_id)=1);

create or replace function public.queue_orphan_photos() returns integer language plpgsql security definer set search_path='' as $$ declare n integer; m integer; begin
 insert into public.community_photo_cleanup(path) select o.name from storage.objects o where bucket_id='community-photos' and created_at<now()-interval '24 hours'
 and not exists(select 1 from public.parenting_post_photos p where o.name in(p.path,replace(p.path,'.webp','-480.webp'))) on conflict do nothing;
 get diagnostics n=row_count;
 insert into public.child_photo_cleanup(path) select o.name from storage.objects o where bucket_id='child-care-photos' and created_at<now()-interval '24 hours'
 and not exists(select 1 from public.child_record_photos p where p.path=public.child_photo_original_path(o.name))
 and not exists(select 1 from public.child_app_icons i where i.path=o.name) on conflict do nothing;
 get diagnostics m=row_count; return n+m;
end $$;

drop table public.community_photos,public.community_reactions,public.community_bookmarks,public.community_comments,public.community_posts,public.community_boards;

drop function public.queue_community_photo_cleanup();

drop function public.community_comment_visible(uuid);

drop function public.community_post_visible(uuid);

drop function public.community_photo_upload_allowed(text);

drop function public.community_board_visible(uuid);

drop function public.community_board_locations();

create or replace function public.community_command(p_action text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare until_time timestamptz;
begin
 if not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action in ('hide','unhide','restrict','unrestrict','notice','resolve') then
  if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
  if length(coalesce(p_data->>'reason','')) not between 1 and 500 then raise exception 'reason_required'; end if;
  if p_action in ('hide','unhide') then
   if p_data->>'kind'='comment' then raise exception 'invalid_action' using errcode='22023';
   else update public.neighborhood_posts set hidden=(p_action='hide') where id=p_id; end if;
  elsif p_action='restrict' then
   until_time:=now()+make_interval(days=>greatest(1,least(365,coalesce((p_data->>'days')::int,7))));
   insert into public.community_restrictions values(p_id,until_time,p_data->>'reason') on conflict(user_id) do update set until_at=excluded.until_at,reason=excluded.reason;
  elsif p_action='unrestrict' then delete from public.community_restrictions where user_id=p_id;
  elsif p_action='notice' then raise exception 'invalid_action' using errcode='22023';
  else update public.community_reports set status='resolved' where id=p_id; end if;
  insert into public.moderation_actions(moderator_id,action,subject_id,reason) values(auth.uid(),p_action,p_id,p_data->>'reason'); return;
 end if;
 if p_action='unblock' then delete from public.community_blocks where user_id=auth.uid() and blocked_id=p_id; return; end if;
 raise exception 'invalid_action' using errcode='22023';
end $$;

drop function public.parenting_feed(uuid,boolean,text,timestamptz,uuid,text,bigint,text);
drop function public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb,text);

create or replace function public.parenting_feed(p_family uuid,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null,p_sort text default 'all',p_before_score bigint default null,p_query text default '')
returns table(id uuid,title text,body text,category text,area_label text,created_at timestamptz,mine boolean,photo_ids uuid[],author_identity jsonb,likes bigint,comments bigint,views bigint,rank_score bigint)
language plpgsql stable security definer set search_path='' as $$ declare a jsonb; needle text; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_sort is null or p_sort not in ('all','popular') then raise exception 'invalid sort' using errcode='22023';end if;
 if p_query is null or length(p_query)>80 then raise exception 'invalid search' using errcode='22023';end if;
 needle:='%'||replace(replace(replace(btrim(p_query),E'\\',E'\\\\'), '%',E'\\%'),'_',E'\\_')||'%';
 a:=public.community_home_area(p_family);
 return query with candidates as (select p.*,
 (select count(*) from public.parenting_post_likes l where l.post_id=p.id) as like_count,
 (select count(*) from public.parenting_post_comments c where c.post_id=p.id) as comments_count,
 (select count(distinct c.user_id) from public.parenting_post_comments c where c.post_id=p.id) as commenters
 from public.neighborhood_posts p where not p.hidden and p.country=a->>'country' and p.feature='boards' and (btrim(p_query)='' or (p.title||' '||p.body) ilike needle) and (p_sort='all' or p.created_at>=now()-interval '7 days')),
 ranked as(select p.*,p.like_count*4+p.commenters*3+p.view_count as score from candidates p)
 select p.id,p.title,p.body,p.category,
 coalesce(nullif(concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,nullif(p.area_locality,'')),''),p.country),p.created_at,p.author_id=auth.uid(),
 array(select photo.id from public.parenting_post_photos photo where photo.post_id=p.id order by photo.sort_order),p.author_identity,p.like_count,p.comments_count,p.view_count,p.score
 from ranked p where p.feature='boards' and p.country=a->>'country'
 and p.audience='neighborhood' and p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality'
 and (p_category='all' or p.category=p_category)
 and (p_before is null or (p_sort='all' and (p.created_at,p.id)<(p_before,p_before_id)) or (p_sort='popular' and (p.score,p.created_at,p.id)<(p_before_score,p_before,p_before_id)))
 order by case when p_sort='popular' then p.score end desc,p.created_at desc,p.id desc limit 50;
end $$;

create or replace function public.save_parenting_post(p_family uuid,p_category text,p_title text,p_body text,p_id uuid default gen_random_uuid(),p_photo_ids uuid[] default '{}',p_child uuid default null,p_poll jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare a jsonb; photo uuid; object_path text; idx integer:=0; identity jsonb; begin
 if not public.account_active() or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_photo_ids is null or cardinality(p_photo_ids)>9 or (select count(distinct x) from unnest(p_photo_ids) x)<>cardinality(p_photo_ids) then raise exception 'invalid photos' using errcode='22023'; end if;
 identity:=public.parenting_identity(p_family,p_child);
 a:=public.community_home_area(p_family);
 if nullif(a->>'country','') is null then raise exception 'residence_required' using errcode='22023'; end if;
 if nullif(a->>'locality','') is null then raise exception 'residence_required' using errcode='22023';end if;
 insert into public.neighborhood_posts(id,region,feature,family_id,author_id,title,body,category,country,area_city,area_district,area_locality,author_identity,audience)
 values(p_id,a->>'country'||':'||lower(coalesce(a->>'district','')),'boards',p_family,auth.uid(),p_title,p_body,p_category,a->>'country',a->>'city',a->>'district',a->>'locality',identity,'neighborhood');
 foreach photo in array p_photo_ids loop
  object_path:=auth.uid()::text||'/neighborhood/'||p_id::text||'/'||photo::text||'.webp';
  if (select count(*) from storage.objects where bucket_id='community-photos' and name in(object_path,replace(object_path,'.webp','-480.webp')) and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint between 1 and 5242880)<>2 then raise exception 'photo_missing' using errcode='22023'; end if;
  insert into public.parenting_post_photos(id,post_id,path,sort_order) values(photo,p_id,object_path,idx);idx:=idx+1;
 end loop;
 if p_poll is not null then
  if jsonb_typeof(p_poll)<>'object' or p_poll->>'question' is null or length(trim(p_poll->>'question')) not between 1 and 150 or jsonb_typeof(p_poll->'options') is distinct from 'array' then raise exception 'invalid poll' using errcode='22023';end if;
  if jsonb_array_length(p_poll->'options') not between 2 and 6 or exists(select 1 from jsonb_array_elements(p_poll->'options') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 80) or (select count(distinct lower(trim(v))) from jsonb_array_elements_text(p_poll->'options') v)<>jsonb_array_length(p_poll->'options') then raise exception 'invalid poll' using errcode='22023';end if;
  insert into public.parenting_post_polls(post_id,question,options) values(p_id,trim(p_poll->>'question'),p_poll->'options');
 end if;
 return p_id;
end $$;

revoke all on function public.parenting_feed(uuid,text,timestamptz,uuid,text,bigint,text),public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb) from public,anon;
grant execute on function public.parenting_feed(uuid,text,timestamptz,uuid,text,bigint,text),public.save_parenting_post(uuid,text,text,text,uuid,uuid[],uuid,jsonb) to authenticated;

create or replace function public.parenting_post_visible(p_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.neighborhood_posts p where p.id=p_post and not p.hidden and p.feature='boards' and
 (p.author_id=auth.uid() or exists(select 1 from public.family_members m join public.families f on f.id=m.family_id cross join lateral (select public.community_home_area(f.id) a) area where m.user_id=auth.uid() and f.merged_into is null and f.residence_country_code=p.country and ((p.area_city=area.a->>'city' and p.area_district=area.a->>'district' and p.area_locality=area.a->>'locality')))));
$$;

create or replace function public.parenting_post_detail(p_post uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'views',p.view_count,'audience',p.audience,'mine',coalesce(p.author_id=auth.uid(),false),'title',p.title,'body',p.body,'category',p.category,'author',p.author_identity,'created_at',p.created_at,'area',concat_ws(' ',case when p.country='KR' then p.area_district else p.area_city end,p.area_locality),
 'photos',coalesce((select jsonb_agg(x.id order by x.sort_order) from public.parenting_post_photos x where x.post_id=p.id),'[]'::jsonb),
 'likes',(select count(*) from public.parenting_post_likes l where l.post_id=p.id),'liked',exists(select 1 from public.parenting_post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
 'comment_count',(select count(*) from public.parenting_post_comments c where c.post_id=p.id),
 'poll',(select jsonb_build_object('question',q.question,'options',q.options,'total',(select count(*) from public.parenting_post_votes v where v.post_id=p.id),'mine',(select v.option_index from public.parenting_post_votes v where v.post_id=p.id and v.user_id=auth.uid()),'counts',(select coalesce(jsonb_object_agg(x.option_index,x.n),'{}'::jsonb) from (select v.option_index,count(*) n from public.parenting_post_votes v where v.post_id=p.id group by v.option_index)x)) from public.parenting_post_polls q where q.post_id=p.id)) into result from public.neighborhood_posts p where p.id=p_post;
 return result;
end $$;

drop table public.parenting_post_announcements;

create or replace function public.parenting_post_interact(p_post uuid,p_child uuid,p_kind text,p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare fid uuid;identity jsonb;options_count integer;comment_data jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select family_id into fid from public.children where id=p_child;
 identity:=public.parenting_identity(fid,p_child);
 if p_kind='like' and p_value in ('on','off') then
  if p_value='on' then insert into public.parenting_post_likes values(p_post,auth.uid()) on conflict do nothing;else delete from public.parenting_post_likes where post_id=p_post and user_id=auth.uid();end if;
 elsif p_kind='comment' then
  if p_value is null or length(trim(p_value)) not between 1 and 1000 then raise exception 'invalid comment' using errcode='22023';end if;
  insert into public.parenting_post_comments(post_id,user_id,body,author_identity) values(p_post,auth.uid(),trim(p_value),identity) returning jsonb_build_object('id',id,'body',body,'author',author_identity,'created_at',created_at,'parent_id',parent_id,'likes',0,'liked',false,'reply_count',0) into comment_data;
 elsif p_kind='vote' then
  select jsonb_array_length(options) into options_count from public.parenting_post_polls where post_id=p_post for share;
  if p_value is null or p_value!~'^[0-5]$' or options_count is null or p_value::integer>=options_count then raise exception 'invalid option' using errcode='22023';end if;
  insert into public.parenting_post_votes values(p_post,auth.uid(),p_value::integer) on conflict(post_id,user_id) do update set option_index=excluded.option_index;
 else raise exception 'invalid action' using errcode='22023';end if;
return comment_data;
end $$;

create or replace function public.admin_reports(p_status text default 'open',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,created_at timestamptz,status text,kind text,title text,body text,reason text,hidden boolean,version integer,resolution_note text,resolved_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_service_admin();
 if p_status is null or p_status not in ('open','resolved','all') then raise exception 'invalid status' using errcode='22023'; end if;
 return query select r.id,r.created_at,r.status,
 case when r.diary_record_id is not null then 'diary' else 'neighborhood' end,
 coalesce(r.post_snapshot->>'title',r.diary_nickname,'성장일기'),coalesce(r.post_snapshot->>'body',r.diary_note,''),r.reason,
 case when r.parenting_post_id is not null then coalesce(p.hidden,true) else coalesce(s.hidden,true) end,r.version,r.resolution_note,r.resolved_at
 from public.community_reports r left join public.neighborhood_posts p on p.id=r.parenting_post_id
 left join public.growth_diary_shares s on s.record_id=r.diary_record_id
 where (r.parenting_post_id is not null or r.diary_record_id is not null) and (p_status='all' or r.status=p_status)
 and (p_before is null or (r.created_at,r.id)<(p_before,p_before_id)) order by r.created_at desc,r.id desc limit 31;
end $$;

alter table public.neighborhood_posts alter column audience set default 'neighborhood';
alter table public.neighborhood_posts drop constraint neighborhood_posts_audience_check;
alter table public.neighborhood_posts add constraint neighborhood_posts_audience_check check(audience='neighborhood');

create or replace function public.record_service_page_view(p_screen text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_screen is null or p_screen not in ('today','insights','diary','community','account') then raise exception 'invalid screen' using errcode='22023'; end if;
 insert into public.service_usage_daily(day,screen,views) values((now() at time zone 'Asia/Seoul')::date,p_screen,1)
 on conflict(day,screen) do update set views=public.service_usage_daily.views+1;
end $$;

create or replace function public.admin_service_page_views(p_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_service_admin();
 if p_days is null or p_days not in (7,14,28) then raise exception 'invalid period' using errcode='22023'; end if;
 return jsonb_build_object('days',p_days,'timezone','Asia/Seoul','screens',(
 select jsonb_agg(jsonb_build_object('screen',s.screen,'views',coalesce(c.views,0)) order by s.position)
 from unnest(array['today','insights','diary','community','account']) with ordinality s(screen,position)
 left join (select screen,sum(views) views from public.service_usage_daily where day between (now() at time zone 'Asia/Seoul')::date-(p_days-1) and (now() at time zone 'Asia/Seoul')::date group by screen) c using(screen)));
end $$;

create or replace function public.report_service_error(p_id uuid,p_section text,p_code text,p_digest text default null) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.service_error_events where user_id=auth.uid() and created_at>=now()-interval '1 hour')>=20 then return; end if;
 insert into public.service_error_events(id,user_id,section,code,digest) values(p_id,auth.uid(),p_section,p_code,p_digest) on conflict(id) do nothing;
end $$;

delete from public.service_usage_daily where screen='calendar';
alter table public.service_usage_daily drop constraint service_usage_daily_screen_check;
alter table public.service_usage_daily add constraint service_usage_daily_screen_check check(screen in ('today','insights','diary','community','account'));
delete from public.service_error_events where section='calendar';
alter table public.service_error_events drop constraint service_error_events_section_check;
alter table public.service_error_events add constraint service_error_events_section_check check(section in ('today','insights','diary','account','admin','other'));

alter table public.residence_regions drop column community_scope;

notify pgrst,'reload schema';
commit;
