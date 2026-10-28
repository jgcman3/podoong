begin;
create table public.developer_requests (
 id uuid primary key,
 user_id uuid not null references public.profiles on delete cascade,
 category text not null check(category in ('feature','bug','other')),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 status text not null default 'received' check(status in ('received','reviewing','done'))
);
create index developer_requests_recent on public.developer_requests(created_at desc,id);
alter table public.developer_requests enable row level security;
revoke all on public.developer_requests from public,anon,authenticated;
grant select on public.developer_requests to authenticated;
create policy developer_requests_own on public.developer_requests for select to authenticated using(user_id=auth.uid() and public.account_active());
create function public.submit_developer_request(p_id uuid,p_category text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$ declare old public.developer_requests; begin
 if auth.uid() is null or not public.account_active() or not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into old from public.developer_requests where id=p_id;
 if old.id is not null then
  if old.user_id<>auth.uid() then raise exception 'forbidden' using errcode='42501'; end if;
  return old.id;
 end if;
 insert into public.developer_requests(id,user_id,category,body) values(p_id,auth.uid(),p_category,trim(p_body));
 return p_id;
end $$;
revoke all on function public.submit_developer_request(uuid,text,text) from public,anon;
grant execute on function public.submit_developer_request(uuid,text,text) to authenticated;
commit;
