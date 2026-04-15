-- User profiles (roles), per-user storage quota/usage, admin RPCs, and secure organizer file registration.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_storage_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  max_storage_bytes bigint not null default 52428800 check (max_storage_bytes > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_storage_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used_storage_bytes bigint not null default 0 check (used_storage_bytes >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_role_idx on public.user_profiles (role);

-- ---------------------------------------------------------------------------
-- 2. New user bootstrap (quota + profile)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_storage_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, role, created_at, updated_at)
  values (new.id, 'user', now(), now())
  on conflict (user_id) do nothing;

  insert into public.user_storage_quota (user_id, max_storage_bytes, updated_at)
  values (new.id, 52428800, now())
  on conflict (user_id) do nothing;

  insert into public.user_storage_usage (user_id, used_storage_bytes, updated_at)
  values (new.id, 0, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student_tools on auth.users;
create trigger on_auth_user_created_student_tools
  after insert on auth.users
  for each row execute function public.handle_new_user_storage_profile();

-- ---------------------------------------------------------------------------
-- 3. Backfill existing auth users
-- ---------------------------------------------------------------------------

insert into public.user_profiles (user_id, role, created_at, updated_at)
select id, 'user', now(), now() from auth.users
on conflict (user_id) do nothing;

insert into public.user_storage_quota (user_id, max_storage_bytes, updated_at)
select id, 52428800, now() from auth.users
on conflict (user_id) do nothing;

insert into public.user_storage_usage (user_id, used_storage_bytes, updated_at)
select id, 0, now() from auth.users
on conflict (user_id) do nothing;

update public.user_storage_usage u
set
  used_storage_bytes = s.total,
  updated_at = now()
from (
  select user_id, sum(size) as total
  from public.organizer_file_cloud
  group by user_id
) s
where u.user_id = s.user_id;

-- ---------------------------------------------------------------------------
-- 4. Admin helper (SECURITY DEFINER bypasses RLS for the check)
-- ---------------------------------------------------------------------------

create or replace function public.user_is_admin(check_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = check_uid
      and role = 'admin'
  );
$$;

grant execute on function public.user_is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS: user_profiles
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own_or_admin" on public.user_profiles;
create policy "user_profiles_select_own_or_admin"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = user_id or public.user_is_admin(auth.uid()));

drop policy if exists "user_profiles_update_admin_role" on public.user_profiles;
create policy "user_profiles_update_admin_role"
  on public.user_profiles for update
  to authenticated
  using (public.user_is_admin(auth.uid()))
  with check (public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. RLS: user_storage_quota / user_storage_usage (read own or admin; no direct writes)
-- ---------------------------------------------------------------------------

alter table public.user_storage_quota enable row level security;
alter table public.user_storage_usage enable row level security;

drop policy if exists "user_storage_quota_select" on public.user_storage_quota;
create policy "user_storage_quota_select"
  on public.user_storage_quota for select
  to authenticated
  using (auth.uid() = user_id or public.user_is_admin(auth.uid()));

drop policy if exists "user_storage_usage_select" on public.user_storage_usage;
create policy "user_storage_usage_select"
  on public.user_storage_usage for select
  to authenticated
  using (auth.uid() = user_id or public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. organizer_file_cloud: remove direct writes for authenticated; keep read
-- ---------------------------------------------------------------------------

drop policy if exists "organizer_file_cloud_insert_own" on public.organizer_file_cloud;
drop policy if exists "organizer_file_cloud_update_own" on public.organizer_file_cloud;
drop policy if exists "organizer_file_cloud_delete_own" on public.organizer_file_cloud;

drop policy if exists "organizer_file_cloud_select_own" on public.organizer_file_cloud;
create policy "organizer_file_cloud_select_own"
  on public.organizer_file_cloud for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "organizer_file_cloud_select_admin" on public.organizer_file_cloud;
create policy "organizer_file_cloud_select_admin"
  on public.organizer_file_cloud for select
  to authenticated
  using (public.user_is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. RPC: register organizer file (quota + metadata) — server-side enforcement
-- ---------------------------------------------------------------------------

create or replace function public.register_organizer_cloud_file(
  p_file_id text,
  p_subject_id text,
  p_name text,
  p_size bigint,
  p_type text,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old_size bigint := 0;
  v_delta bigint;
  v_max bigint;
  v_used bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  if p_file_id is null or length(trim(p_file_id)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  if p_size is null or p_size < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  if p_storage_path is null
     or split_part(p_storage_path, '/', 1) is distinct from v_uid::text then
    return jsonb_build_object('ok', false, 'code', 'invalid_path');
  end if;

  insert into public.user_profiles (user_id, role, created_at, updated_at)
  values (v_uid, 'user', now(), now())
  on conflict (user_id) do nothing;

  insert into public.user_storage_quota (user_id, max_storage_bytes, updated_at)
  values (v_uid, 52428800, now())
  on conflict (user_id) do nothing;

  insert into public.user_storage_usage (user_id, used_storage_bytes, updated_at)
  values (v_uid, 0, now())
  on conflict (user_id) do nothing;

  select ffc.size into v_old_size
  from public.organizer_file_cloud ffc
  where ffc.user_id = v_uid and ffc.file_id = p_file_id;

  if not found then
    v_old_size := 0;
  end if;

  v_delta := p_size - coalesce(v_old_size, 0);

  select coalesce(q.max_storage_bytes, 52428800)
  into v_max
  from public.user_storage_quota q
  where q.user_id = v_uid;

  if v_max is null then
    v_max := 52428800;
  end if;

  select coalesce(u.used_storage_bytes, 0)
  into v_used
  from public.user_storage_usage u
  where u.user_id = v_uid
  for update;

  if v_used is null then
    v_used := 0;
  end if;

  if v_delta > 0 and v_used + v_delta > v_max then
    return jsonb_build_object('ok', false, 'code', 'quota_exceeded');
  end if;

  insert into public.organizer_file_cloud (
    user_id,
    file_id,
    subject_id,
    name,
    size,
    type,
    storage_path,
    updated_at,
    created_at
  )
  values (
    v_uid,
    p_file_id,
    p_subject_id,
    p_name,
    p_size,
    coalesce(p_type, 'application/octet-stream'),
    p_storage_path,
    now(),
    now()
  )
  on conflict (user_id, file_id) do update set
    subject_id = excluded.subject_id,
    name = excluded.name,
    size = excluded.size,
    type = excluded.type,
    storage_path = excluded.storage_path,
    updated_at = now();

  update public.user_storage_usage
  set
    used_storage_bytes = greatest(0, coalesce(used_storage_bytes, 0) + v_delta),
    updated_at = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.register_organizer_cloud_file(
  text, text, text, bigint, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC: unregister (delete metadata + decrement usage)
-- ---------------------------------------------------------------------------

create or replace function public.unregister_organizer_cloud_file(p_file_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_size bigint;
  v_path text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select ffc.size, ffc.storage_path into v_size, v_path
  from public.organizer_file_cloud ffc
  where ffc.user_id = v_uid and ffc.file_id = p_file_id;

  if not found then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;

  delete from public.organizer_file_cloud
  where user_id = v_uid and file_id = p_file_id;

  update public.user_storage_usage
  set
    used_storage_bytes = greatest(0, coalesce(used_storage_bytes, 0) - coalesce(v_size, 0)),
    updated_at = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'storage_path', v_path);
end;
$$;

grant execute on function public.unregister_organizer_cloud_file(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC: admin — list users + storage
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_users_with_storage()
returns table (
  user_id uuid,
  email text,
  role text,
  used_storage_bytes bigint,
  max_storage_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id as user_id,
    u.email::text as email,
    coalesce(p.role, 'user')::text as role,
    coalesce(su.used_storage_bytes, 0)::bigint as used_storage_bytes,
    coalesce(sq.max_storage_bytes, 52428800)::bigint as max_storage_bytes
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  left join public.user_storage_usage su on su.user_id = u.id
  left join public.user_storage_quota sq on sq.user_id = u.id
  order by coalesce(su.used_storage_bytes, 0) desc;
end;
$$;

grant execute on function public.admin_list_users_with_storage() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC: admin — set quota
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_user_storage_quota(
  p_user_id uuid,
  p_max_storage_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_max_storage_bytes is null or p_max_storage_bytes < 1048576 then
    raise exception 'invalid quota';
  end if;

  insert into public.user_storage_quota (user_id, max_storage_bytes, updated_at)
  values (p_user_id, p_max_storage_bytes, now())
  on conflict (user_id) do update set
    max_storage_bytes = excluded.max_storage_bytes,
    updated_at = now();
end;
$$;

grant execute on function public.admin_set_user_storage_quota(uuid, bigint) to authenticated;
