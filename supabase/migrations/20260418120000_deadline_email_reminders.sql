-- Deadline Tracker email reminders: settings, events, RLS, helper for service-role email lookup

-- ---------------------------------------------------------------------------
-- 1. Settings (per user, opt-in)
-- ---------------------------------------------------------------------------

create table if not exists public.deadline_reminder_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  remind_24h boolean not null default true,
  remind_3h boolean not null default true,
  remind_overdue boolean not null default true,
  daily_summary_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Events (one row per user/task/reminder_type; service role writes)
-- ---------------------------------------------------------------------------

create table if not exists public.deadline_reminder_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  reminder_type text not null check (
    reminder_type in ('24h_before', '3h_before', 'overdue_once')
  ),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed', 'skipped')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_id, reminder_type)
);

create index if not exists deadline_reminder_events_send_idx
  on public.deadline_reminder_events (status, scheduled_for)
  where status = 'pending';

create index if not exists deadline_reminder_events_user_idx
  on public.deadline_reminder_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Email lookup for Edge Functions (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.get_user_email_for_reminders(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email::text from auth.users where id = p_user_id limit 1;
$$;

revoke all on function public.get_user_email_for_reminders(uuid) from public;
grant execute on function public.get_user_email_for_reminders(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

alter table public.deadline_reminder_settings enable row level security;
alter table public.deadline_reminder_events enable row level security;

drop policy if exists "deadline_reminder_settings_select_own" on public.deadline_reminder_settings;
create policy "deadline_reminder_settings_select_own"
  on public.deadline_reminder_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "deadline_reminder_settings_insert_own" on public.deadline_reminder_settings;
create policy "deadline_reminder_settings_insert_own"
  on public.deadline_reminder_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "deadline_reminder_settings_update_own" on public.deadline_reminder_settings;
create policy "deadline_reminder_settings_update_own"
  on public.deadline_reminder_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "deadline_reminder_events_select_own" on public.deadline_reminder_events;
create policy "deadline_reminder_events_select_own"
  on public.deadline_reminder_events for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete for authenticated on events — Edge Functions use service_role
