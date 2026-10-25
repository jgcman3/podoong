create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 60),
  locale text not null default 'ko' check (locale in ('ko','en')),
  timezone text not null default 'Asia/Seoul',
  consented_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.family_members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (family_id,user_id)
);
create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null check (length(name) between 1 and 60),
  due_date date, birth_date date,
  created_at timestamptz not null default now(),
  check (due_date is not null or birth_date is not null),
  unique (id,family_id)
);
create table public.child_access (
  child_id uuid not null,
  family_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('editor','viewer')),
  primary key (child_id,user_id),
  foreign key (child_id,family_id) references public.children(id,family_id) on delete cascade,
  foreign key (family_id,user_id) references public.family_members(family_id,user_id) on delete cascade
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  child_id uuid not null,
  role text not null check (role in ('editor','viewer')),
  token_hash text not null unique,
  created_by uuid not null references public.profiles,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz, revoked_at timestamptz,
  foreign key (child_id,family_id) references public.children(id,family_id) on delete cascade
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  subject_id uuid,
  created_at timestamptz not null default now()
);

create function public.is_family_owner(fid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.family_members where family_id = fid and user_id = auth.uid() and role = 'owner');
$$;
create function public.is_family_member(fid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;
create function public.can_read_child(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.children c join public.family_members m on m.family_id=c.family_id
    where c.id=cid and m.user_id=auth.uid() and (m.role='owner' or exists(
      select 1 from public.child_access a where a.child_id=cid and a.user_id=auth.uid())));
$$;
create function public.can_write_child(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.children c join public.family_members m on m.family_id=c.family_id
    where c.id=cid and m.user_id=auth.uid() and (m.role='owner' or (m.role='editor' and exists(
      select 1 from public.child_access a where a.child_id=cid and a.user_id=auth.uid() and a.role='editor'))));
$$;

create function public.create_family_with_child(p_family_name text,p_child_name text,p_due_date date,p_birth_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid; cid uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'consent_required'; end if;
  insert into public.families(name) values(p_family_name) returning id into fid;
  insert into public.family_members values(fid,auth.uid(),'owner');
  insert into public.children(family_id,name,due_date,birth_date) values(fid,p_child_name,p_due_date,p_birth_date) returning id into cid;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'family_created',cid);
  return cid;
end $$;

create function public.create_invitation(p_child_id uuid,p_role text) returns text language plpgsql security definer set search_path = '' as $$
declare fid uuid; token text;
begin
  select family_id into fid from public.children where id=p_child_id;
  if not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
  token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.invitations(family_id,child_id,role,token_hash,created_by)
    values(fid,p_child_id,p_role,encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'invitation_created',p_child_id);
  return token;
end $$;
create function public.accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invitations;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and consented_at is not null) then raise exception 'consent_required'; end if;
  select * into inv from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'invalid_invitation'; end if;
  insert into public.family_members values(inv.family_id,auth.uid(),inv.role)
    on conflict(family_id,user_id) do update set role=case when public.family_members.role='owner' then 'owner'
      when public.family_members.role='editor' or excluded.role='editor' then 'editor' else 'viewer' end;
  insert into public.child_access values(inv.child_id,inv.family_id,auth.uid(),inv.role)
    on conflict(child_id,user_id) do update set role=excluded.role;
  update public.invitations set accepted_at=now() where id=inv.id;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(inv.family_id,auth.uid(),'invitation_accepted',inv.child_id);
  return inv.child_id;
end $$;
create function public.revoke_member(p_family_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_owner(p_family_id) or p_user_id=auth.uid() then raise exception 'forbidden' using errcode='42501'; end if;
  delete from public.family_members where family_id=p_family_id and user_id=p_user_id and role<>'owner';
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(p_family_id,auth.uid(),'member_revoked',p_user_id);
end $$;
create function public.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  select family_id into fid from public.invitations where id=p_id;
  if not public.is_family_owner(fid) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.invitations set revoked_at=now() where id=p_id and accepted_at is null;
  insert into public.audit_events(family_id,actor_id,action,subject_id) values(fid,auth.uid(),'invitation_revoked',p_id);
end $$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.child_access enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.profiles,public.families,public.family_members,public.children,public.child_access,public.invitations,public.audit_events from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.families,public.family_members,public.child_access,public.invitations,public.audit_events to authenticated;
grant select,insert on public.children to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy own_profile_create on public.profiles for insert to authenticated with check(id=auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy family_read on public.families for select to authenticated using(public.is_family_member(id));
create policy members_read on public.family_members for select to authenticated using(public.is_family_member(family_id));
create policy child_read on public.children for select to authenticated using(public.can_read_child(id));
create policy child_create on public.children for insert to authenticated with check(public.is_family_owner(family_id));
create policy access_read on public.child_access for select to authenticated using(user_id=auth.uid() or public.is_family_owner(family_id));
create policy invitation_read on public.invitations for select to authenticated using(public.is_family_owner(family_id));
create policy audit_read on public.audit_events for select to authenticated using(public.is_family_owner(family_id));

revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_family_owner(uuid), public.is_family_member(uuid),public.can_read_child(uuid),public.can_write_child(uuid),
  public.create_family_with_child(text,text,date,date),public.create_invitation(uuid,text),public.accept_invitation(text),public.revoke_member(uuid,uuid),public.revoke_invitation(uuid) to authenticated;
