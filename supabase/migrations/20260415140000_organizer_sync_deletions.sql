-- Propagate deletes across devices (notes/links/subjects removed elsewhere)

create table if not exists public.organizer_sync_deletions (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null check (entity in ('subject', 'note', 'link')),
  entity_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, entity, entity_id)
);

create index if not exists organizer_sync_deletions_user_id_idx
  on public.organizer_sync_deletions (user_id);

alter table public.organizer_sync_deletions enable row level security;

drop policy if exists "organizer_sync_deletions_select_own" on public.organizer_sync_deletions;
create policy "organizer_sync_deletions_select_own"
  on public.organizer_sync_deletions for select
  using (auth.uid() = user_id);

drop policy if exists "organizer_sync_deletions_insert_own" on public.organizer_sync_deletions;
create policy "organizer_sync_deletions_insert_own"
  on public.organizer_sync_deletions for insert
  with check (auth.uid() = user_id);

drop policy if exists "organizer_sync_deletions_update_own" on public.organizer_sync_deletions;
create policy "organizer_sync_deletions_update_own"
  on public.organizer_sync_deletions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organizer_sync_deletions_delete_own" on public.organizer_sync_deletions;
create policy "organizer_sync_deletions_delete_own"
  on public.organizer_sync_deletions for delete
  using (auth.uid() = user_id);
