-- Reject a stale compose screen rather than posting into a changed home board.
create or replace function public.community_command(p_action text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare author uuid; pid uuid; cid uuid; until_time timestamptz; target_board uuid; location record; board_scope text; board_topic text; existing_post public.community_posts; home_version integer;
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
  select * into existing_post from public.community_posts where id=p_id for update;
  if found then
   if existing_post.author_id<>auth.uid() or not public.community_post_visible(p_id) then raise exception 'forbidden' using errcode='42501'; end if;
   -- Editing text never moves an existing conversation, its comments or photos.
   update public.community_posts set title=btrim(p_data->>'title'),body=btrim(p_data->>'body'),updated_at=now() where id=p_id;
  else
   if p_data->>'board' in ('district','locality') then board_scope:=p_data->>'board';
   elsif p_data->>'board' ~ '^topic:(pregnancy|birth|feeding|health|daily)$' then board_scope:='topic'; board_topic:=split_part(p_data->>'board',':',2);
   else raise exception 'invalid board' using errcode='22023'; end if;
   -- Pin the residence used by the compose screen through the insert transaction.
   select f.residence_version into home_version from public.families f
    where f.id=(p_data->>'familyId')::uuid and exists(
     select 1 from public.family_members m where m.family_id=f.id and m.user_id=auth.uid()
    ) for share;
   if not found then raise exception 'residence required' using errcode='42501'; end if;
   if home_version is distinct from (p_data->>'residenceVersion')::integer then raise exception 'conflict'; end if;
   select * into location from public.community_board_locations() l
    where l.family_id=(p_data->>'familyId')::uuid and l.scope=board_scope;
   if not found then raise exception 'residence required' using errcode='42501'; end if;
   insert into public.community_boards(country_code,scope,region_code,topic,region_label)
    values(location.country_code,board_scope,location.region_code,board_topic,coalesce(location.region_name,location.country_name))
    on conflict(country_code,scope,region_code,topic) do update set region_label=excluded.region_label
    returning id into target_board;
   insert into public.community_posts(id,author_id,title,body,region,topic,board_id)
    values(p_id,auth.uid(),btrim(p_data->>'title'),btrim(p_data->>'body'),coalesce(location.region_name,location.country_name),coalesce(board_topic,'daily'),target_board);
  end if;
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
