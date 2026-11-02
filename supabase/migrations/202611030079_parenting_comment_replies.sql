begin;
alter table public.parenting_post_comments add column parent_id uuid references public.parenting_post_comments on delete cascade;
create index parenting_reply_page on public.parenting_post_comments(parent_id,created_at,id) where parent_id is not null;
create index parenting_root_comment_page on public.parenting_post_comments(post_id,created_at,id) where parent_id is null;
create table public.parenting_comment_likes(comment_id uuid references public.parenting_post_comments on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(comment_id,user_id));
create index parenting_comment_like_user on public.parenting_comment_likes(user_id);
alter table public.parenting_comment_likes enable row level security;
revoke all on public.parenting_comment_likes from public,anon,authenticated;
grant all on public.parenting_comment_likes to service_role;
create function public.parenting_comment_json(p_comment uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'body',c.body,'author',c.author_identity,'created_at',c.created_at,'parent_id',c.parent_id,
 'likes',(select count(*) from public.parenting_comment_likes l where l.comment_id=c.id),'liked',exists(select 1 from public.parenting_comment_likes l where l.comment_id=c.id and l.user_id=auth.uid()),'reply_count',(select count(*) from public.parenting_post_comments r where r.parent_id=c.id)) from public.parenting_post_comments c where c.id=p_comment;
$$;
revoke all on function public.parenting_comment_json(uuid) from public,anon,authenticated;
create or replace function public.parenting_post_comments_page(p_post uuid,p_after timestamptz default null,p_after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(public.parenting_comment_json(x.id) order by x.created_at,x.id) from (select c.id,c.created_at from public.parenting_post_comments c where c.post_id=p_post and c.parent_id is null and (p_after is null or (c.created_at,c.id)>(p_after,p_after_id)) order by c.created_at,c.id limit 30)x),'[]'::jsonb);
end $$;
create function public.parenting_comment_replies(p_comment uuid,p_after timestamptz default null,p_after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$declare post uuid;begin
 select post_id into post from public.parenting_post_comments where id=p_comment and parent_id is null;
 if post is null or not public.parenting_post_visible(post) then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(public.parenting_comment_json(x.id) order by x.created_at,x.id) from (select c.id,c.created_at from public.parenting_post_comments c where c.parent_id=p_comment and (p_after is null or (c.created_at,c.id)>(p_after,p_after_id)) order by c.created_at,c.id limit 30)x),'[]'::jsonb);
end $$;
create function public.parenting_comment_interact(p_comment uuid,p_child uuid,p_kind text,p_value text) returns jsonb language plpgsql security definer set search_path='' as $$declare post uuid;root uuid;fid uuid;identity jsonb;result_id uuid;begin
 select post_id,coalesce(parent_id,id) into post,root from public.parenting_post_comments where id=p_comment;
 if post is null or not public.parenting_post_visible(post) then raise exception 'forbidden' using errcode='42501';end if;
 select family_id into fid from public.children where id=p_child;
 identity:=public.parenting_identity(fid,p_child);
 if p_kind='like' and p_value in ('on','off') then
  if p_value='on' then insert into public.parenting_comment_likes values(p_comment,auth.uid()) on conflict do nothing;else delete from public.parenting_comment_likes where comment_id=p_comment and user_id=auth.uid();end if;
  result_id:=p_comment;
 elsif p_kind='reply' then
  if p_value is null or length(trim(p_value)) not between 1 and 1000 then raise exception 'invalid comment' using errcode='22023';end if;
  insert into public.parenting_post_comments(post_id,user_id,body,author_identity,parent_id) values(post,auth.uid(),trim(p_value),identity,root) returning id into result_id;
 else raise exception 'invalid action' using errcode='22023';end if;
 return jsonb_build_object('comment',public.parenting_comment_json(result_id),'parent',public.parenting_comment_json(root),'comment_count',(select count(*) from public.parenting_post_comments c where c.post_id=post));
end $$;
revoke all on function public.parenting_comment_replies(uuid,timestamptz,uuid),public.parenting_comment_interact(uuid,uuid,text,text) from public,anon;
grant execute on function public.parenting_comment_replies(uuid,timestamptz,uuid),public.parenting_comment_interact(uuid,uuid,text,text) to authenticated;
create or replace function public.parenting_post_interact(p_post uuid,p_child uuid,p_kind text,p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare fid uuid;identity jsonb;a jsonb;options_count integer;comment_data jsonb;begin
 if not public.parenting_post_visible(p_post) then raise exception 'forbidden' using errcode='42501';end if;
 select family_id into fid from public.children where id=p_child;
 identity:=public.parenting_identity(fid,p_child);
 if p_kind='like' and p_value in ('on','off') then
  if p_value='on' then insert into public.parenting_post_likes values(p_post,auth.uid()) on conflict do nothing;else delete from public.parenting_post_likes where post_id=p_post and user_id=auth.uid();end if;
 elsif p_kind='announce' and p_value in ('on','off') then
  if p_value='off' then delete from public.parenting_post_announcements where post_id=p_post and user_id=auth.uid();else
   a:=public.community_home_area(fid);
   if nullif(a->>'locality','') is null or nullif(a->>'city','') is null or nullif(a->>'district','') is null or (select country from public.neighborhood_posts where id=p_post) is distinct from a->>'country' then raise exception 'residence_required' using errcode='22023';end if;
   insert into public.parenting_post_announcements values(p_post,auth.uid(),a->>'country',a->>'city',a->>'district',a->>'locality') on conflict(post_id,user_id) do update set country=excluded.country,city=excluded.city,district=excluded.district,locality=excluded.locality;
  end if;
 elsif p_kind='comment' then
  if p_value is null or length(trim(p_value)) not between 1 and 1000 then raise exception 'invalid comment' using errcode='22023';end if;
  insert into public.parenting_post_comments(post_id,user_id,body,author_identity) values(p_post,auth.uid(),trim(p_value),identity) returning jsonb_build_object('id',id,'body',body,'author',author_identity,'created_at',created_at,'parent_id',parent_id,'likes',0,'liked',false,'reply_count',0) into comment_data;
 elsif p_kind='vote' then
  select jsonb_array_length(options) into options_count from public.parenting_post_polls where post_id=p_post;
  if p_value is null or p_value!~'^[0-5]$' or options_count is null or p_value::integer>=options_count then raise exception 'invalid option' using errcode='22023';end if;
  insert into public.parenting_post_votes values(p_post,auth.uid(),p_value::integer) on conflict(post_id,user_id) do update set option_index=excluded.option_index;
 else raise exception 'invalid action' using errcode='22023';end if;
return comment_data;
end $$;
notify pgrst,'reload schema';
commit;
