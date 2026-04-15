-- Deadline Tracker + Study Timer cloud sync (per-user, RLS)

-- —— Deadline Tracker ————————————————————————————————————————————

create table if not exists public.deadline_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, task_id)
);

create index if not exists deadline_tasks_user_id_idx on public.deadline_tasks (user_id);

create table if not exists public.deadline_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sort_mode text,
  ordered_task_ids jsonb,
  recent_courses jsonb,
  language text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- —— Study Timer —————————————————————————————————————————————————

create table if not exists public.study_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_key text not null,
  completed_at_ms bigint not null,
  duration_minutes int not null,
  created_at timestamptz not null default now(),
  unique (user_id, session_key)
);

create index if not exists study_timer_sessions_user_id_idx
  on public.study_timer_sessions (user_id);

create table if not exists public.study_timer_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  focus_minutes int not null default 25,
  break_minutes int not null default 5,
  updated_at timestamptz not null default now()
);

-- —— RLS ——————————————————————————————————————————————————————————

alter table public.deadline_tasks enable row level security;
alter table public.deadline_preferences enable row level security;
alter table public.study_timer_sessions enable row level security;
alter table public.study_timer_preferences enable row level security;

-- deadline_tasks
drop policy if exists "deadline_tasks_select_own" on public.deadline_tasks;
create policy "deadline_tasks_select_own"
  on public.deadline_tasks for select
  using (auth.uid() = user_id);

drop policy if exists "deadline_tasks_insert_own" on public.deadline_tasks;
create policy "deadline_tasks_insert_own"
  on public.deadline_tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "deadline_tasks_update_own" on public.deadline_tasks;
create policy "deadline_tasks_update_own"
  on public.deadline_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "deadline_tasks_delete_own" on public.deadline_tasks;
create policy "deadline_tasks_delete_own"
  on public.deadline_tasks for delete
  using (auth.uid() = user_id);

-- deadline_preferences
drop policy if exists "deadline_preferences_select_own" on public.deadline_preferences;
create policy "deadline_preferences_select_own"
  on public.deadline_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "deadline_preferences_insert_own" on public.deadline_preferences;
create policy "deadline_preferences_insert_own"
  on public.deadline_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "deadline_preferences_update_own" on public.deadline_preferences;
create policy "deadline_preferences_update_own"
  on public.deadline_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "deadline_preferences_delete_own" on public.deadline_preferences;
create policy "deadline_preferences_delete_own"
  on public.deadline_preferences for delete
  using (auth.uid() = user_id);

-- study_timer_sessions
drop policy if exists "study_timer_sessions_select_own" on public.study_timer_sessions;
create policy "study_timer_sessions_select_own"
  on public.study_timer_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "study_timer_sessions_insert_own" on public.study_timer_sessions;
create policy "study_timer_sessions_insert_own"
  on public.study_timer_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "study_timer_sessions_update_own" on public.study_timer_sessions;
create policy "study_timer_sessions_update_own"
  on public.study_timer_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "study_timer_sessions_delete_own" on public.study_timer_sessions;
create policy "study_timer_sessions_delete_own"
  on public.study_timer_sessions for delete
  using (auth.uid() = user_id);

-- study_timer_preferences
drop policy if exists "study_timer_preferences_select_own" on public.study_timer_preferences;
create policy "study_timer_preferences_select_own"
  on public.study_timer_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "study_timer_preferences_insert_own" on public.study_timer_preferences;
create policy "study_timer_preferences_insert_own"
  on public.study_timer_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "study_timer_preferences_update_own" on public.study_timer_preferences;
create policy "study_timer_preferences_update_own"
  on public.study_timer_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "study_timer_preferences_delete_own" on public.study_timer_preferences;
create policy "study_timer_preferences_delete_own"
  on public.study_timer_preferences for delete
  using (auth.uid() = user_id);
