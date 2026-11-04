begin;
alter table public.neighborhood_posts add column hidden boolean not null default false;
alter table public.community_reports
 add column parenting_post_id uuid references public.neighborhood_posts on delete cascade,
 add column post_snapshot jsonb,
 add column version integer not null default 0,
 add column resolved_at timestamptz,
 add column resolved_by uuid references public.profiles on delete set null,
 add column resolution_note text check(length(resolution_note)<=500);
alter table public.community_reports drop constraint report_single_subject;
alter table public.community_reports add constraint report_single_subject check(num_nonnulls(post_id,comment_id,diary_record_id,parenting_post_id)=1);
create unique index one_open_parenting_report on public.community_reports(reporter_id,parenting_post_id) where status='open' and parenting_post_id is not null;
create index community_reports_review_queue on public.community_reports(status,created_at desc,id desc);
create function public.version_community_report() returns trigger language plpgsql set search_path='' as $$
begin
 new.version:=old.version+1;
 if new.status is distinct from old.status then
  new.resolved_at:=case when new.status='resolved' then now() else null end;
  new.resolved_by:=case when new.status='resolved' then auth.uid() else null end;
 end if;
 return new;
end $$;
revoke all on function public.version_community_report() from public,anon,authenticated;
create trigger version_community_report before update on public.community_reports for each row execute function public.version_community_report();
create or replace function public.parenting_post_visible(p_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active() and exists(select 1 from public.neighborhood_posts p where p.id=p_post and not p.hidden and p.feature='boards' and
 (p.author_id=auth.uid() or exists(select 1 from public.family_members m join public.families f on f.id=m.family_id cross join lateral (select public.community_home_area(f.id) a) area where m.user_id=auth.uid() and f.merged_into is null and f.residence_country_code=p.country and (p.audience='country' or (p.area_city=area.a->>'city' and p.area_district=area.a->>'district' and p.area_locality=area.a->>'locality')))));
$$;
create or replace function public.parenting_feed(p_family uuid,p_neighborhood boolean default false,p_category text default 'all',p_before timestamptz default null,p_before_id uuid default null,p_sort text default 'all',p_before_score bigint default null,p_query text default '')
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
 and ((not p_neighborhood and p.audience='country') or (p_neighborhood and ((p.audience='neighborhood' and p.area_city=a->>'city' and p.area_district=a->>'district' and p.area_locality=a->>'locality') or (p.audience='country' and exists(select 1 from public.parenting_post_announcements n where n.post_id=p.id and n.country=a->>'country' and n.city=a->>'city' and n.district=a->>'district' and n.locality=a->>'locality')))))
 and (p_category='all' or p.category=p_category)
 and (p_before is null or (p_sort='all' and (p.created_at,p.id)<(p_before,p_before_id)) or (p_sort='popular' and (p.score,p.created_at,p.id)<(p_before_score,p_before,p_before_id)))
 order by case when p_sort='popular' then p.score end desc,p.created_at desc,p.id desc limit 50;
end $$;

create function public.report_parenting_post(p_post uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare post public.neighborhood_posts;
begin
 if not public.community_participant() or not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reason' using errcode='22023'; end if;
 select * into post from public.neighborhood_posts where id=p_post for share;
 if post.author_id=auth.uid() or post.hidden then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.community_reports where reporter_id=auth.uid() and parenting_post_id=p_post and status='open') then return; end if;
 if (select count(*) from public.community_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'report limit' using errcode='22023'; end if;
 insert into public.community_reports(reporter_id,parenting_post_id,reason,post_snapshot)
 values(auth.uid(),p_post,trim(p_reason),jsonb_build_object('title',post.title,'body',post.body,'audience',post.audience,'category',post.category,'area',concat_ws(' ',post.area_city,post.area_district,post.area_locality)));
end $$;
revoke all on function public.report_parenting_post(uuid,text) from public,anon;
grant execute on function public.report_parenting_post(uuid,text) to authenticated;

-- Both everyone and birth-date cohorts can report diaries they are permitted to read.
create or replace function public.report_growth_diary(p_child uuid,p_record uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_read_child(p_child) or not public.growth_diary_photo_allowed(p_record)
 or exists(select 1 from public.child_records r where r.id=p_record and public.can_read_child(r.child_id)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reason' using errcode='22023'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.community_reports where reporter_id=auth.uid() and diary_record_id=p_record and status='open') then return; end if;
 if (select count(*) from public.community_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'report limit' using errcode='22023'; end if;
 insert into public.community_reports(reporter_id,diary_record_id,reason,diary_note,diary_nickname)
 select auth.uid(),r.id,trim(p_reason),r.note,c.name from public.child_records r join public.children c on c.id=r.child_id where r.id=p_record
 on conflict(reporter_id,diary_record_id) where status='open' and diary_record_id is not null do nothing;
end $$;

create function public.admin_reports(p_status text default 'open',p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,created_at timestamptz,status text,kind text,title text,body text,reason text,hidden boolean,version integer,resolution_note text,resolved_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_service_admin();
 if p_status is null or p_status not in ('open','resolved','all') then raise exception 'invalid status' using errcode='22023'; end if;
 return query select r.id,r.created_at,r.status,
 case when r.diary_record_id is not null then 'diary' when r.post_snapshot->>'audience'='neighborhood' then 'neighborhood' else 'country' end,
 coalesce(r.post_snapshot->>'title',r.diary_nickname,'성장일기'),coalesce(r.post_snapshot->>'body',r.diary_note,''),r.reason,
 case when r.parenting_post_id is not null then coalesce(p.hidden,true) else coalesce(s.hidden,true) end,r.version,r.resolution_note,r.resolved_at
 from public.community_reports r left join public.neighborhood_posts p on p.id=r.parenting_post_id
 left join public.growth_diary_shares s on s.record_id=r.diary_record_id
 where (r.parenting_post_id is not null or r.diary_record_id is not null) and (p_status='all' or r.status=p_status)
 and (p_before is null or (r.created_at,r.id)<(p_before,p_before_id)) order by r.created_at desc,r.id desc limit 31;
end $$;

alter table public.admin_audit_log drop constraint admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check(action in ('request_update','error_resolve','admin_grant','admin_change','admin_revoke','report_hide','report_unhide','report_resolve','report_reopen'));
create function public.admin_review_report(p_report uuid,p_action text,p_reason text,p_version integer,p_expected_hidden boolean) returns void
language plpgsql security definer set search_path='' as $$
declare report public.community_reports; current_hidden boolean; target uuid;
begin
 perform public.require_service_admin();
 if p_action is null or p_action not in ('hide','unhide','resolve','reopen') or p_reason is null or length(trim(p_reason)) not between 1 and 500 or p_version is null or p_expected_hidden is null then raise exception 'invalid review' using errcode='22023'; end if;
 select * into report from public.community_reports where id=p_report and (parenting_post_id is not null or diary_record_id is not null) for update;
 if not found then raise exception 'not found' using errcode='22023'; end if;
 if report.version<>p_version then raise exception 'conflict' using errcode='40001'; end if;
 target:=coalesce(report.parenting_post_id,report.diary_record_id);
 if p_action in ('hide','unhide') then
  if report.parenting_post_id is not null then
   select hidden into current_hidden from public.neighborhood_posts where id=target for update;
  else
   select hidden into current_hidden from public.growth_diary_shares where record_id=target for update;
  end if;
  if not found then raise exception 'not found' using errcode='22023'; end if;
  if current_hidden is distinct from p_expected_hidden then raise exception 'conflict' using errcode='40001'; end if;
  if report.parenting_post_id is not null then update public.neighborhood_posts set hidden=p_action='hide' where id=target;
  else update public.growth_diary_shares set hidden=p_action='hide' where record_id=target; end if;
 end if;
 update public.community_reports set resolution_note=trim(p_reason),status=case when p_action='resolve' then 'resolved' when p_action='reopen' then 'open' else status end where id=p_report;
 insert into public.admin_audit_log(actor_id,action,subject_id,details)
 values(auth.uid(),'report_'||p_action,p_report,jsonb_build_object('subject',target,'note',trim(p_reason)));
end $$;
revoke all on function public.admin_reports(text,timestamptz,uuid),public.admin_review_report(uuid,text,text,integer,boolean) from public,anon;
grant execute on function public.admin_reports(text,timestamptz,uuid),public.admin_review_report(uuid,text,text,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
