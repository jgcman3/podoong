-- Public community content is independent of private family and child records.
create table public.community_moderators(user_id uuid primary key references public.profiles on delete cascade);
create table public.community_restrictions(user_id uuid primary key references public.profiles on delete cascade, until_at timestamptz not null, reason text not null check(length(reason) between 1 and 500));
create table public.community_blocks(user_id uuid references public.profiles on delete cascade, blocked_id uuid references public.profiles on delete cascade, primary key(user_id,blocked_id), check(user_id<>blocked_id));
create table public.community_posts(id uuid primary key, author_id uuid not null references public.profiles on delete cascade, title text not null check(length(title) between 1 and 200), body text not null check(length(body) between 1 and 10000), region text not null check(length(region) between 1 and 60), topic text not null check(topic in ('pregnancy','birth','feeding','health','daily')), notice boolean not null default false, hidden boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.community_posts(created_at desc,id);
create table public.community_comments(id uuid primary key, post_id uuid not null references public.community_posts on delete cascade, author_id uuid not null references public.profiles on delete cascade, body text not null check(length(body) between 1 and 2000), hidden boolean not null default false, created_at timestamptz not null default now());
create index on public.community_comments(post_id,created_at);
create table public.community_reactions(post_id uuid references public.community_posts on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(post_id,user_id));
create table public.community_bookmarks(post_id uuid references public.community_posts on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(post_id,user_id));
create table public.community_reports(id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles on delete cascade, post_id uuid references public.community_posts on delete cascade, comment_id uuid references public.community_comments on delete cascade, reason text not null check(length(reason) between 1 and 500), status text not null default 'open' check(status in ('open','resolved')), created_at timestamptz not null default now(), check((post_id is null)<>(comment_id is null)));
create table public.moderation_actions(id bigint generated always as identity primary key, moderator_id uuid references public.profiles on delete set null, action text not null, subject_id uuid not null, reason text not null check(length(reason) between 1 and 500), created_at timestamptz not null default now());
create table public.community_photos(id uuid primary key, post_id uuid not null references public.community_posts on delete cascade, owner_id uuid not null references public.profiles on delete cascade, path text not null unique, content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')), size_bytes integer not null check(size_bytes between 1 and 5242880), created_at timestamptz not null default now(),check(path=owner_id::text||'/'||post_id::text||'/'||id::text));
-- A service worker later deletes these Storage objects. Never expose this queue to clients.
create table public.community_photo_cleanup(path text primary key,queued_at timestamptz not null default now());
create function public.queue_community_photo_cleanup() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.community_photo_cleanup(path) values(old.path) on conflict do nothing; return old; end $$;
create trigger community_photo_cleanup before delete on public.community_photos for each row execute function public.queue_community_photo_cleanup();
create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.community_moderators where user_id=auth.uid()); $$;
create function public.community_participant() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null); $$;
create function public.community_can_write() returns boolean language sql stable security definer set search_path='' as $$ select public.community_participant() and not exists(select 1 from public.community_restrictions where user_id=auth.uid() and until_at>now()); $$;
create function public.community_author_visible(p_author uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.community_participant() and not exists(select 1 from public.community_blocks where (user_id=auth.uid() and blocked_id=p_author) or (blocked_id=auth.uid() and user_id=p_author)); $$;
create function public.community_post_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.community_posts where id=p_id and ((not hidden and public.community_author_visible(author_id)) or public.is_moderator())); $$;
create function public.community_comment_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.community_comments where id=p_id and public.community_post_visible(post_id) and ((not hidden and public.community_author_visible(author_id)) or public.is_moderator())); $$;
create function public.community_photo_upload_allowed(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select public.community_can_write() and exists(select 1 from public.community_posts p where p.id::text=split_part(p_path,'/',2) and p.author_id=auth.uid() and not p.hidden) and split_part(p_path,'/',1)=auth.uid()::text and p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'; $$;
create function public.community_command(p_action text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare author uuid; pid uuid; cid uuid; until_time timestamptz;
begin
 if not public.community_participant() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action in ('hide','unhide','restrict','unrestrict','notice','resolve') then
  if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
  if length(coalesce(p_data->>'reason','')) not between 1 and 500 then raise exception 'reason_required'; end if;
  if p_action in ('hide','unhide') then
   if p_data->>'kind'='comment' then update public.community_comments set hidden=(p_action='hide') where id=p_id;
   else update public.community_posts set hidden=(p_action='hide') where id=p_id; end if;
  elsif p_action='restrict' then
   until_time:=now()+make_interval(days=>greatest(1,least(365,coalesce((p_data->>'days')::int,7))));
   insert into public.community_restrictions values(p_id,until_time,p_data->>'reason') on conflict(user_id) do update set until_at=excluded.until_at,reason=excluded.reason;
  elsif p_action='unrestrict' then delete from public.community_restrictions where user_id=p_id;
  elsif p_action='notice' then update public.community_posts set notice=coalesce((p_data->>'enabled')::boolean,true) where id=p_id;
  else update public.community_reports set status='resolved' where id=p_id; end if;
  insert into public.moderation_actions(moderator_id,action,subject_id,reason) values(auth.uid(),p_action,p_id,p_data->>'reason'); return;
 end if;
 -- Safety controls remain available while a user is restricted.
 if p_action='block' then insert into public.community_blocks values(auth.uid(),p_id) on conflict do nothing; return;
 elsif p_action='unblock' then delete from public.community_blocks where user_id=auth.uid() and blocked_id=p_id; return; end if;
 if p_action='report' then
  if p_data->>'kind'='comment' then
   if not public.community_comment_visible(p_id) then raise exception 'forbidden' using errcode='42501'; end if; cid:=p_id;
  else if not public.community_post_visible(p_id) then raise exception 'forbidden' using errcode='42501'; end if; pid:=p_id; end if;
  insert into public.community_reports(reporter_id,post_id,comment_id,reason) values(auth.uid(),pid,cid,p_data->>'reason'); return;
 end if;
 if not public.community_can_write() then raise exception 'restricted' using errcode='42501'; end if;
 if p_action='post' then
  select author_id into author from public.community_posts where id=p_id for update;
  if found and (author<>auth.uid() or not public.community_post_visible(p_id)) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.community_posts(id,author_id,title,body,region,topic) values(p_id,auth.uid(),btrim(p_data->>'title'),btrim(p_data->>'body'),btrim(p_data->>'region'),p_data->>'topic') on conflict(id) do update set title=excluded.title,body=excluded.body,region=excluded.region,topic=excluded.topic,updated_at=now() where community_posts.author_id=auth.uid() and not community_posts.hidden;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_action='comment' then
  pid:=(p_data->>'postId')::uuid;
  if not public.community_post_visible(pid) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.community_comments(id,post_id,author_id,body) values(p_id,pid,auth.uid(),btrim(p_data->>'body')) on conflict(id) do update set body=excluded.body where community_comments.author_id=auth.uid() and community_comments.post_id=excluded.post_id and not community_comments.hidden;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_action='delete-post' then delete from public.community_posts where id=p_id and author_id=auth.uid(); if not found then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_action='delete-comment' then delete from public.community_comments where id=p_id and author_id=auth.uid(); if not found then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_action in ('reaction','bookmark') then
  if not public.community_post_visible(p_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_action='reaction' then
   if coalesce((p_data->>'enabled')::boolean,true) then insert into public.community_reactions values(p_id,auth.uid()) on conflict do nothing; else delete from public.community_reactions where post_id=p_id and user_id=auth.uid(); end if;
  else if coalesce((p_data->>'enabled')::boolean,true) then insert into public.community_bookmarks values(p_id,auth.uid()) on conflict do nothing; else delete from public.community_bookmarks where post_id=p_id and user_id=auth.uid(); end if; end if;
 elsif p_action='photo' then
  pid:=(p_data->>'postId')::uuid;
  perform 1 from public.community_posts where id=pid for update;
  if not public.community_photo_upload_allowed(p_data->>'path') or split_part(p_data->>'path','/',2)<>pid::text or split_part(p_data->>'path','/',3)<>p_id::text then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects where bucket_id='community-photos' and name=p_data->>'path') then raise exception 'upload_missing'; end if;
  if (select count(*) from public.community_photos where post_id=pid)>=4 then raise exception 'photo_limit'; end if;
  insert into public.community_photos values(p_id,pid,auth.uid(),p_data->>'path',p_data->>'contentType',(p_data->>'size')::int,now());
 elsif p_action='delete-photo' then delete from public.community_photos where id=p_id and owner_id=auth.uid(); if not found then raise exception 'forbidden' using errcode='42501'; end if;
 else raise exception 'invalid_action'; end if;
end $$;
do $$ declare t text; begin foreach t in array array['community_moderators','community_restrictions','community_blocks','community_posts','community_comments','community_reactions','community_bookmarks','community_reports','moderation_actions','community_photos','community_photo_cleanup'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); if t<>'community_photo_cleanup' then execute format('grant select on public.%I to authenticated',t); end if; end loop; end $$;
create policy moderators_read on public.community_moderators for select to authenticated using(user_id=auth.uid() or public.is_moderator());
create policy restrictions_read on public.community_restrictions for select to authenticated using(user_id=auth.uid() or public.is_moderator());
create policy blocks_read on public.community_blocks for select to authenticated using(user_id=auth.uid());
create policy posts_read on public.community_posts for select to authenticated using(public.community_post_visible(id));
create policy comments_read on public.community_comments for select to authenticated using(public.community_comment_visible(id));
-- Individual reactions/bookmarks are private; do not disclose who saved a post.
create policy reactions_read on public.community_reactions for select to authenticated using(user_id=auth.uid() and public.community_post_visible(post_id));
create policy bookmarks_read on public.community_bookmarks for select to authenticated using(user_id=auth.uid() and public.community_post_visible(post_id));
create policy reports_read on public.community_reports for select to authenticated using(reporter_id=auth.uid() or public.is_moderator());
create policy moderation_read on public.moderation_actions for select to authenticated using(public.is_moderator());
create policy photos_read on public.community_photos for select to authenticated using(public.community_post_visible(post_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-photos','community-photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy community_photo_delete on storage.objects for delete to authenticated using(bucket_id='community-photos' and split_part(name,'/',1)=auth.uid()::text);
-- No Storage SELECT grant: clients cannot mint signed URLs. The server photo
-- proxy checks user RLS live, then downloads with a server-only Storage credential.
revoke execute on function public.queue_community_photo_cleanup() from public;
revoke execute on function public.is_moderator(),public.community_participant(),public.community_can_write(),public.community_author_visible(uuid),public.community_post_visible(uuid),public.community_comment_visible(uuid),public.community_photo_upload_allowed(text),public.community_command(text,uuid,jsonb) from public,anon;
grant execute on function public.is_moderator(),public.community_participant(),public.community_can_write(),public.community_author_visible(uuid),public.community_post_visible(uuid),public.community_comment_visible(uuid),public.community_photo_upload_allowed(text),public.community_command(text,uuid,jsonb) to authenticated;
