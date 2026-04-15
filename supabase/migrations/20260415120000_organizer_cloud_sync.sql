-- Study Organizer Phase 1: subjects, notes, links (no file blobs)

create table if not exists public.organizer_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, subject_id)
);

create index if not exists organizer_subjects_user_id_idx
  on public.organizer_subjects (user_id);

create table if not exists public.organizer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id text not null,
  subject_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, note_id)
);

create index if not exists organizer_notes_user_id_idx
  on public.organizer_notes (user_id);

create index if not exists organizer_notes_subject_id_idx
  on public.organizer_notes (user_id, subject_id);

create table if not exists public.organizer_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  link_id text not null,
  subject_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, link_id)
);

create index if not exists organizer_links_user_id_idx
  on public.organizer_links (user_id);

-- RLS

alter table public.organizer_subjects enable row level security;
alter table public.organizer_notes enable row level security;
alter table public.organizer_links enable row level security;

drop policy if exists "organizer_subjects_select_own" on public.organizer_subjects;
create policy "organizer_subjects_select_own"
  on public.organizer_subjects for select
  using (auth.uid() = user_id);

drop policy if exists "organizer_subjects_insert_own" on public.organizer_subjects;
create policy "organizer_subjects_insert_own"
  on public.organizer_subjects for insert
  with check (auth.uid() = user_id);

drop policy if exists "organizer_subjects_update_own" on public.organizer_subjects;
create policy "organizer_subjects_update_own"
  on public.organizer_subjects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organizer_subjects_delete_own" on public.organizer_subjects;
create policy "organizer_subjects_delete_own"
  on public.organizer_subjects for delete
  using (auth.uid() = user_id);

drop policy if exists "organizer_notes_select_own" on public.organizer_notes;
create policy "organizer_notes_select_own"
  on public.organizer_notes for select
  using (auth.uid() = user_id);

drop policy if exists "organizer_notes_insert_own" on public.organizer_notes;
create policy "organizer_notes_insert_own"
  on public.organizer_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "organizer_notes_update_own" on public.organizer_notes;
create policy "organizer_notes_update_own"
  on public.organizer_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organizer_notes_delete_own" on public.organizer_notes;
create policy "organizer_notes_delete_own"
  on public.organizer_notes for delete
  using (auth.uid() = user_id);

drop policy if exists "organizer_links_select_own" on public.organizer_links;
create policy "organizer_links_select_own"
  on public.organizer_links for select
  using (auth.uid() = user_id);

drop policy if exists "organizer_links_insert_own" on public.organizer_links;
create policy "organizer_links_insert_own"
  on public.organizer_links for insert
  with check (auth.uid() = user_id);

drop policy if exists "organizer_links_update_own" on public.organizer_links;
create policy "organizer_links_update_own"
  on public.organizer_links for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "organizer_links_delete_own" on public.organizer_links;
create policy "organizer_links_delete_own"
  on public.organizer_links for delete
  using (auth.uid() = user_id);
