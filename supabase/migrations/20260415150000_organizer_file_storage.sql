-- Per-file metadata + Storage bucket for optional organizer file sync

-- Allow 'file' in deletion log (existing installs)
alter table public.organizer_sync_deletions
  drop constraint if exists organizer_sync_deletions_entity_check;

alter table public.organizer_sync_deletions
  add constraint organizer_sync_deletions_entity_check
  check (entity in ('subject', 'note', 'link', 'file'));

-- Metadata for files uploaded to Storage (blobs live in bucket)
create table if not exists public.organizer_file_cloud (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_id text not null,
  subject_id text not null,
  name text not null,
  size bigint not null,
  type text not null,
  storage_path text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, file_id)
);

create index if not exists organizer_file_cloud_user_id_idx
  on public.organizer_file_cloud (user_id);

alter table public.organizer_file_cloud enable row level security;

drop policy if exists "organizer_file_cloud_select_own" on public.organizer_file_cloud;
create policy "organizer_file_cloud_select_own"
  on public.organizer_file_cloud for select
  using (auth.uid() = user_id);

drop policy if exists "organizer_file_cloud_insert_own" on public.organizer_file_cloud;
create policy "organizer_file_cloud_insert_own"
  on public.organizer_file_cloud for insert
  with check (auth.uid() = user_id);

drop policy if exists "organizer_file_cloud_update_own" on public.organizer_file_cloud;
create policy "organizer_file_cloud_update_own"
  on public.organizer_file_cloud for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organizer_file_cloud_delete_own" on public.organizer_file_cloud;
create policy "organizer_file_cloud_delete_own"
  on public.organizer_file_cloud for delete
  using (auth.uid() = user_id);

-- Storage bucket (private; paths: {user_uuid}/{file_id}/{filename})
insert into storage.buckets (id, name, public, file_size_limit)
values ('organizer-files', 'organizer-files', false, 8388608)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Policies on storage.objects
drop policy if exists "organizer_files_storage_select" on storage.objects;
create policy "organizer_files_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'organizer-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "organizer_files_storage_insert" on storage.objects;
create policy "organizer_files_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'organizer-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "organizer_files_storage_update" on storage.objects;
create policy "organizer_files_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'organizer-files'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'organizer-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "organizer_files_storage_delete" on storage.objects;
create policy "organizer_files_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'organizer-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );
