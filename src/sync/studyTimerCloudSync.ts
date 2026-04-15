/**
 * Cloud sync for Study Timer (Supabase).
 * Syncs focus/break preferences + completed session history only (not live countdown).
 *
 * Merge: union sessions by session_key; prefs last-write-wins (updated_at vs local meta).
 */
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import type { FocusSessionRecord } from "../studyTimerStats";
import {
  clampMinutes,
  DEFAULT_BREAK_MIN,
  DEFAULT_FOCUS_MIN,
  pruneFocusHistory,
} from "../studyTimerStats";

export const TIMER_SYNC_META_KEY = "student-tools-timer-sync-meta";

export type TimerLocalSyncMeta = {
  prefsUpdatedAt: string;
};

export function loadTimerSyncMeta(): TimerLocalSyncMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_SYNC_META_KEY);
    if (!raw) return null;
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const prefsUpdatedAt = (o as Record<string, unknown>).prefsUpdatedAt;
    if (typeof prefsUpdatedAt !== "string") return null;
    return { prefsUpdatedAt };
  } catch {
    return null;
  }
}

export function saveTimerSyncMeta(meta: TimerLocalSyncMeta): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIMER_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function sessionKey(r: FocusSessionRecord): string {
  return `${r.completedAt}-${r.durationMinutes}`;
}

type CloudSessionRow = {
  session_key: string;
  completed_at_ms: number;
  duration_minutes: number;
};

export async function fetchTimerFromCloud(user: User): Promise<{
  prefs: {
    focus_minutes: number;
    break_minutes: number;
    updated_at: string;
  } | null;
  sessions: CloudSessionRow[];
  error: Error | null;
}> {
  const sb = getSupabase();
  const uid = user.id;

  const [prefsRes, sessRes] = await Promise.all([
    sb
      .from("study_timer_preferences")
      .select("focus_minutes, break_minutes, updated_at")
      .eq("user_id", uid)
      .maybeSingle(),
    sb
      .from("study_timer_sessions")
      .select("session_key, completed_at_ms, duration_minutes")
      .eq("user_id", uid),
  ]);

  if (prefsRes.error && prefsRes.error.code !== "PGRST116") {
    return { prefs: null, sessions: [], error: new Error(prefsRes.error.message) };
  }
  if (sessRes.error) {
    return { prefs: null, sessions: [], error: new Error(sessRes.error.message) };
  }

  const prefs = prefsRes.data as {
    focus_minutes: number;
    break_minutes: number;
    updated_at: string;
  } | null;

  const sessions: CloudSessionRow[] = [];
  for (const row of sessRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const session_key = typeof r.session_key === "string" ? r.session_key : "";
    const completed_at_ms =
      typeof r.completed_at_ms === "number" ? r.completed_at_ms : NaN;
    const duration_minutes =
      typeof r.duration_minutes === "number" ? r.duration_minutes : NaN;
    if (!session_key || !Number.isFinite(completed_at_ms)) continue;
    sessions.push({
      session_key,
      completed_at_ms,
      duration_minutes: Number.isFinite(duration_minutes)
        ? clampMinutes(duration_minutes)
        : 25,
    });
  }

  return { prefs, sessions, error: null };
}

export function mergeTimerHistory(
  local: FocusSessionRecord[],
  cloud: CloudSessionRow[],
): FocusSessionRecord[] {
  const map = new Map<string, FocusSessionRecord>();
  for (const r of local) {
    map.set(sessionKey(r), r);
  }
  for (const row of cloud) {
    const r: FocusSessionRecord = {
      completedAt: row.completed_at_ms,
      durationMinutes: clampMinutes(row.duration_minutes),
    };
    const k = sessionKey(r);
    if (!map.has(k)) map.set(k, r);
  }
  return pruneFocusHistory(Array.from(map.values()));
}

export function mergeTimerPrefs(
  localFocus: number,
  localBreak: number,
  localMeta: TimerLocalSyncMeta | null,
  hasLocalHistory: boolean,
  cloudPrefs: { focus_minutes: number; break_minutes: number; updated_at: string } | null,
): { focusMinutes: number; breakMinutes: number } {
  if (!cloudPrefs) {
    return { focusMinutes: localFocus, breakMinutes: localBreak };
  }
  /* Prefer local prefs when user has history or has changed durations from defaults but has no meta yet. */
  const localPrefsTouched =
    clampMinutes(localFocus) !== DEFAULT_FOCUS_MIN ||
    clampMinutes(localBreak) !== DEFAULT_BREAK_MIN;
  const localAt = localMeta?.prefsUpdatedAt
    ? new Date(localMeta.prefsUpdatedAt).getTime()
    : hasLocalHistory || localPrefsTouched
      ? Number.MAX_SAFE_INTEGER
      : 0;
  const cloudAt = new Date(cloudPrefs.updated_at).getTime();
  if (cloudAt > localAt) {
    return {
      focusMinutes: clampMinutes(cloudPrefs.focus_minutes),
      breakMinutes: clampMinutes(cloudPrefs.break_minutes),
    };
  }
  return { focusMinutes: localFocus, breakMinutes: localBreak };
}

const INSERT_CHUNK = 200;

export async function pushTimerToCloud(
  user: User,
  focusMinutes: number,
  breakMinutes: number,
  history: FocusSessionRecord[],
): Promise<{ error: Error | null }> {
  const sb = getSupabase();
  const uid = user.id;
  const now = new Date().toISOString();

  const { error: pErr } = await sb.from("study_timer_preferences").upsert(
    {
      user_id: uid,
      focus_minutes: clampMinutes(focusMinutes),
      break_minutes: clampMinutes(breakMinutes),
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (pErr) return { error: new Error(pErr.message) };

  const { error: delErr } = await sb
    .from("study_timer_sessions")
    .delete()
    .eq("user_id", uid);
  if (delErr) return { error: new Error(delErr.message) };

  const pruned = pruneFocusHistory(history);
  for (let i = 0; i < pruned.length; i += INSERT_CHUNK) {
    const chunk = pruned.slice(i, i + INSERT_CHUNK);
    const rows = chunk.map((r) => ({
      user_id: uid,
      session_key: sessionKey(r),
      completed_at_ms: r.completedAt,
      duration_minutes: r.durationMinutes,
    }));
    const { error: insErr } = await sb.from("study_timer_sessions").insert(rows);
    if (insErr) return { error: new Error(insErr.message) };
  }

  return { error: null };
}
