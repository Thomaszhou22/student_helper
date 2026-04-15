/**
 * Shared study-timer focus history + formatting (used by Study Timer page and hub).
 */

export type StudyTimerLang = "en" | "zh";

export type FocusSessionRecord = {
  completedAt: number;
  durationMinutes: number;
};

export const STUDY_TIMER_STORAGE_KEY = "student-tools-study-timer";

/** Fired after timer storage is patched (same-tab; hub strip listens to refresh weekly total). */
export const STUDY_TIMER_UPDATED_EVENT = "student-tools-study-timer-updated";

/**
 * Synchronously clear focus history + today's session count in localStorage, then dispatch
 * {@link STUDY_TIMER_UPDATED_EVENT}. Use when clearing from Study Timer so the hub strip updates
 * immediately (storage events do not fire in the same tab that wrote).
 */
export function patchStudyTimerStorageClearFocusHistory(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STUDY_TIMER_STORAGE_KEY);
    if (raw == null || raw === "") return;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return;
    const o = data as Record<string, unknown>;
    const today = todayKey(new Date());
    o.focusHistory = [];
    o.statsDateKey = today;
    o.focusCompletedToday = 0;
    localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(o));
    window.dispatchEvent(new CustomEvent(STUDY_TIMER_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export const DEFAULT_FOCUS_MIN = 25;
export const DEFAULT_BREAK_MIN = 5;
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 120;

export function todayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_FOCUS_MIN;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)));
}


const MAX_FOCUS_RECORDS = 2000;
const PRUNE_MS = 400 * 24 * 60 * 60 * 1000;

export function pruneFocusHistory(
  records: FocusSessionRecord[],
): FocusSessionRecord[] {
  const cutoff = Date.now() - PRUNE_MS;
  const filtered = records.filter((r) => r.completedAt >= cutoff);
  return filtered.slice(-MAX_FOCUS_RECORDS);
}

export function parseFocusHistory(raw: unknown): FocusSessionRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: FocusSessionRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    const completedAt =
      typeof x.completedAt === "number" && Number.isFinite(x.completedAt)
        ? x.completedAt
        : NaN;
    const dm =
      typeof x.durationMinutes === "number" && x.durationMinutes >= 0
        ? Math.round(x.durationMinutes)
        : NaN;
    if (!Number.isFinite(completedAt) || !Number.isFinite(dm)) continue;
    out.push({
      completedAt,
      durationMinutes: clampMinutes(dm),
    });
  }
  return pruneFocusHistory(out);
}

/** Week starts Monday (local). */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sumMinutesToday(
  history: readonly FocusSessionRecord[],
  now: Date,
): number {
  const key = todayKey(now);
  return history
    .filter((r) => todayKey(new Date(r.completedAt)) === key)
    .reduce((s, r) => s + r.durationMinutes, 0);
}

export function sumMinutesThisWeek(
  history: readonly FocusSessionRecord[],
  now: Date,
): number {
  const start = startOfWeekMonday(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return history
    .filter((r) => r.completedAt >= start && r.completedAt < end)
    .reduce((s, r) => s + r.durationMinutes, 0);
}

export function countSessionsToday(
  history: readonly FocusSessionRecord[],
  now: Date,
): number {
  const key = todayKey(now);
  return history.filter((r) => todayKey(new Date(r.completedAt)) === key)
    .length;
}

export function countSessionsThisWeek(
  history: readonly FocusSessionRecord[],
  now: Date,
): number {
  const start = startOfWeekMonday(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return history.filter((r) => r.completedAt >= start && r.completedAt < end)
    .length;
}

/**
 * Under 1h → minutes (supports fractional minutes for live in-progress totals).
 * Else hours (1 decimal when non-whole).
 */
export function formatStudyDuration(
  totalMinutes: number,
  lang: StudyTimerLang,
): string {
  const m = Math.max(0, totalMinutes);
  if (m < 60) {
    const rounded = Math.round(m * 10) / 10;
    const display =
      Math.abs(rounded - Math.round(rounded)) < 0.05
        ? String(Math.round(rounded))
        : rounded.toFixed(1);
    return lang === "zh" ? `${display} 分钟` : `${display} min`;
  }
  const h = m / 60;
  const whole = Math.round(h);
  if (Math.abs(h - whole) < 0.01) {
    return lang === "zh" ? `${whole} 小时` : `${whole} h`;
  }
  return lang === "zh" ? `${h.toFixed(1)} 小时` : `${h.toFixed(1)} h`;
}

/** Completed focus minutes this week from persisted history only (hub / offline summary). */
export function getWeeklyCompletedFocusMinutesFromStorage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STUDY_TIMER_STORAGE_KEY);
    if (!raw) return 0;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return 0;
    const o = data as Record<string, unknown>;
    const history = parseFocusHistory(o.focusHistory);
    return sumMinutesThisWeek(history, new Date());
  } catch {
    return 0;
  }
}
