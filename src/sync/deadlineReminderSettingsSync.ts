/**
 * Load/save Deadline email reminder settings (Supabase, RLS).
 */
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";

export type DeadlineReminderSettingsRow = {
  user_id: string;
  enabled: boolean;
  remind_24h: boolean;
  remind_3h: boolean;
  remind_overdue: boolean;
  daily_summary_enabled: boolean;
  updated_at: string;
  created_at: string;
};

const DEFAULTS: Omit<
  DeadlineReminderSettingsRow,
  "user_id" | "updated_at" | "created_at"
> = {
  enabled: false,
  remind_24h: true,
  remind_3h: true,
  remind_overdue: true,
  daily_summary_enabled: false,
};

export async function fetchDeadlineReminderSettings(
  user: User,
): Promise<{ settings: DeadlineReminderSettingsRow | null; error: Error | null }> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("deadline_reminder_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { settings: null, error: new Error(error.message) };
  if (!data) return { settings: null, error: null };

  const r = data as Record<string, unknown>;
  return {
    settings: {
      user_id: String(r.user_id),
      enabled: r.enabled === true,
      remind_24h: r.remind_24h !== false,
      remind_3h: r.remind_3h !== false,
      remind_overdue: r.remind_overdue !== false,
      daily_summary_enabled: r.daily_summary_enabled === true,
      updated_at:
        typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
      created_at:
        typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    },
    error: null,
  };
}

export async function upsertDeadlineReminderSettings(
  user: User,
  patch: Partial<
    Pick<
      DeadlineReminderSettingsRow,
      | "enabled"
      | "remind_24h"
      | "remind_3h"
      | "remind_overdue"
      | "daily_summary_enabled"
    >
  >,
): Promise<{ error: Error | null }> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const prev = await fetchDeadlineReminderSettings(user);
  if (prev.error) return { error: prev.error };

  const base = prev.settings
    ? {
        enabled: prev.settings.enabled,
        remind_24h: prev.settings.remind_24h,
        remind_3h: prev.settings.remind_3h,
        remind_overdue: prev.settings.remind_overdue,
        daily_summary_enabled: prev.settings.daily_summary_enabled,
      }
    : { ...DEFAULTS };

  const row = {
    user_id: user.id,
    ...base,
    ...patch,
    updated_at: now,
  };

  const { error } = await sb.from("deadline_reminder_settings").upsert(row, {
    onConflict: "user_id",
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
