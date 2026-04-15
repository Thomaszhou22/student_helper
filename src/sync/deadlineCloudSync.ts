/**
 * Cloud sync for Deadline Tracker (Supabase).
 *
 * Merge (MVP): per-task last-write-wins using `deadline_tasks.updated_at` vs
 * `task.clientUpdatedAt`. Preferences last-write-wins using
 * `deadline_preferences.updated_at` vs local `prefsUpdatedAt` in meta.
 * Never replaces non-empty local state with empty cloud without explicit rule.
 */
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import {
  normalizeOrderedTaskIds,
  type DeadlineLang,
  type DeadlineSortMode,
  type DeadlineTask,
} from "../DeadlineTrackerPage";

export type PersistedDeadlineShape = {
  tasks: DeadlineTask[];
  language: DeadlineLang;
  recentCourses: string[];
  sortMode: DeadlineSortMode;
  orderedTaskIds?: string[];
};

export const DEADLINE_SYNC_META_KEY = "student-tools-deadline-sync-meta";

export type DeadlineLocalSyncMeta = {
  /** Bumped when sort/order/recent/language prefs change locally */
  prefsUpdatedAt: string;
  /**
   * Task ids removed on this device; cloud rows for these ids are ignored at merge
   * until a successful push clears them (prevents deleted tasks reappearing).
   */
  tombstoneTaskIds?: string[];
};

const TOMBSTONE_CAP = 500;

/** Bump preference timestamp so merge + cloud treat manual order / prefs as newer. */
export function bumpDeadlinePrefsMeta(): void {
  const prev = loadDeadlineSyncMeta();
  saveDeadlineSyncMeta({
    prefsUpdatedAt: new Date().toISOString(),
    ...(prev?.tombstoneTaskIds?.length
      ? { tombstoneTaskIds: prev.tombstoneTaskIds }
      : {}),
  });
}

/** Record a local deletion so merge does not resurrect this task from cloud before push. */
export function addDeadlineTaskTombstone(taskId: string): void {
  const prev = loadDeadlineSyncMeta();
  const nextTomb = Array.from(
    new Set([...(prev?.tombstoneTaskIds ?? []), taskId]),
  ).slice(-TOMBSTONE_CAP);
  saveDeadlineSyncMeta({
    prefsUpdatedAt: prev?.prefsUpdatedAt ?? new Date().toISOString(),
    tombstoneTaskIds: nextTomb,
  });
}

export function clearDeadlineTombstones(): void {
  const prev = loadDeadlineSyncMeta();
  if (!prev) return;
  saveDeadlineSyncMeta({ prefsUpdatedAt: prev.prefsUpdatedAt });
}

export function loadDeadlineSyncMeta(): DeadlineLocalSyncMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEADLINE_SYNC_META_KEY);
    if (!raw) return null;
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    const prefsUpdatedAt = r.prefsUpdatedAt;
    if (typeof prefsUpdatedAt !== "string") return null;
    let tombstoneTaskIds: string[] | undefined;
    if (Array.isArray(r.tombstoneTaskIds)) {
      tombstoneTaskIds = r.tombstoneTaskIds.filter(
        (x): x is string => typeof x === "string",
      );
    }
    return {
      prefsUpdatedAt,
      ...(tombstoneTaskIds?.length ? { tombstoneTaskIds } : {}),
    };
  } catch {
    return null;
  }
}

export function saveDeadlineSyncMeta(meta: DeadlineLocalSyncMeta): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEADLINE_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

type CloudPrefsRow = {
  user_id: string;
  sort_mode: string | null;
  ordered_task_ids: unknown;
  recent_courses: unknown;
  language: string | null;
  updated_at: string;
};

type CloudTaskRow = {
  task_id: string;
  payload: DeadlineTask;
  updated_at: string;
};

function parsePrefsFromRow(row: CloudPrefsRow): Omit<
  PersistedDeadlineShape,
  "tasks"
> {
  const sortMode: DeadlineSortMode =
    row.sort_mode === "manual" || row.sort_mode === "dueDate"
      ? row.sort_mode
      : "dueDate";
  let orderedTaskIds: string[] | undefined;
  if (Array.isArray(row.ordered_task_ids)) {
    orderedTaskIds = row.ordered_task_ids.filter(
      (x): x is string => typeof x === "string",
    );
  }
  let recentCourses: string[] = [];
  if (Array.isArray(row.recent_courses)) {
    recentCourses = row.recent_courses.filter(
      (x): x is string => typeof x === "string",
    );
  }
  const language: DeadlineLang =
    row.language === "zh" || row.language === "en" ? row.language : "en";
  return { sortMode, orderedTaskIds, recentCourses, language };
}

export async function fetchDeadlineFromCloud(user: User): Promise<{
  prefs: CloudPrefsRow | null;
  tasks: CloudTaskRow[];
  error: Error | null;
}> {
  const sb = getSupabase();
  const uid = user.id;

  const [prefsRes, tasksRes] = await Promise.all([
    sb.from("deadline_preferences").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("deadline_tasks").select("task_id, payload, updated_at").eq("user_id", uid),
  ]);

  if (prefsRes.error && prefsRes.error.code !== "PGRST116") {
    return {
      prefs: null,
      tasks: [],
      error: new Error(prefsRes.error.message),
    };
  }
  if (tasksRes.error) {
    return { prefs: null, tasks: [], error: new Error(tasksRes.error.message) };
  }

  const prefs = (prefsRes.data as CloudPrefsRow | null) ?? null;
  const rawTasks = tasksRes.data ?? [];
  const tasks: CloudTaskRow[] = [];
  for (const row of rawTasks) {
    const r = row as Record<string, unknown>;
    const task_id = typeof r.task_id === "string" ? r.task_id : "";
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString();
    const payload = r.payload;
    if (!task_id || !payload || typeof payload !== "object") continue;
    tasks.push({
      task_id,
      payload: payload as DeadlineTask,
      updated_at,
    });
  }

  return { prefs, tasks, error: null };
}

export type DeadlineMergeOutcome = {
  merged: PersistedDeadlineShape;
  /**
   * True when both sides had durable data and the merge combined them
   * (for optional one-time UX).
   */
  didMergeDistinctSources: boolean;
};

function isPlausibleTaskPayload(p: DeadlineTask): boolean {
  return typeof p.title === "string" && p.title.trim().length > 0 && !!p.dueAt;
}

/** Backfill UTC instant for Edge reminder jobs without importing the page module. */
function withDueAtUtc(p: DeadlineTask): DeadlineTask {
  if (p.dueAtUtc) return p;
  const d = new Date(p.dueAt);
  if (Number.isNaN(d.getTime())) return p;
  return { ...p, dueAtUtc: d.toISOString() };
}

/**
 * Merge local + cloud. Per-task LWW; prefs LWW when timestamps favor cloud.
 * Skips cloud rows in `tombstoneTaskIds` (local deletes not yet pushed).
 * Does not apply empty/stale cloud payloads over non-empty local tasks.
 */
export function mergeDeadlineState(
  local: PersistedDeadlineShape,
  localMeta: DeadlineLocalSyncMeta | null,
  cloudPrefs: CloudPrefsRow | null,
  cloudTasks: CloudTaskRow[],
): DeadlineMergeOutcome {
  const tombstones = new Set(localMeta?.tombstoneTaskIds ?? []);

  /* Without prefs meta, existing local tasks keep local prefs from being overwritten by older cloud. */
  const localPrefsAt = localMeta?.prefsUpdatedAt
    ? new Date(localMeta.prefsUpdatedAt).getTime()
    : local.tasks.length > 0
      ? Number.MAX_SAFE_INTEGER
      : 0;
  const cloudPrefsAt = cloudPrefs?.updated_at
    ? new Date(cloudPrefs.updated_at).getTime()
    : 0;

  let language = local.language;
  let sortMode = local.sortMode ?? "dueDate";
  let orderedTaskIds = local.orderedTaskIds;
  let recentCourses = local.recentCourses;

  if (cloudPrefs && cloudPrefsAt > localPrefsAt) {
    const p = parsePrefsFromRow(cloudPrefs);
    language = p.language;
    sortMode = p.sortMode;
    orderedTaskIds = p.orderedTaskIds;
    recentCourses = p.recentCourses;
  }

  const localIds = new Set(local.tasks.map((t) => t.id));
  const cloudIds = new Set(cloudTasks.map((r) => r.task_id));
  const hadLocalTasks = local.tasks.length > 0;
  const hadCloudTasks = cloudTasks.length > 0;

  const byId = new Map<string, DeadlineTask>();
  for (const t of local.tasks) {
    byId.set(t.id, t);
  }

  for (const row of cloudTasks) {
    if (tombstones.has(row.task_id)) continue;
    if (!isPlausibleTaskPayload(row.payload)) continue;

    const cTime = new Date(row.updated_at).getTime();
    const lid = byId.get(row.task_id);
    const lTime = lid?.clientUpdatedAt
      ? new Date(lid.clientUpdatedAt).getTime()
      : 0;

    if (!lid) {
      byId.set(row.task_id, {
        ...withDueAtUtc(row.payload),
        clientUpdatedAt:
          row.payload.clientUpdatedAt ?? new Date(row.updated_at).toISOString(),
      });
    } else if (cTime > lTime) {
      byId.set(row.task_id, {
        ...withDueAtUtc(row.payload),
        clientUpdatedAt: new Date(row.updated_at).toISOString(),
      });
    }
  }

  const mergedTasks = Array.from(byId.values());
  const merged: PersistedDeadlineShape = {
    tasks: mergedTasks,
    language,
    sortMode,
    recentCourses,
    orderedTaskIds: normalizeOrderedTaskIds(mergedTasks, orderedTaskIds),
  };

  const didMergeDistinctSources =
    hadLocalTasks &&
    hadCloudTasks &&
    (merged.tasks.length !== local.tasks.length ||
      merged.tasks.some((t) => !localIds.has(t.id)) ||
      local.tasks.some((t) => !cloudIds.has(t.id)) ||
      language !== local.language ||
      sortMode !== (local.sortMode ?? "dueDate"));

  return { merged, didMergeDistinctSources };
}

export async function pushDeadlineToCloud(
  user: User,
  state: PersistedDeadlineShape,
): Promise<{ error: Error | null }> {
  const sb = getSupabase();
  const uid = user.id;
  const now = new Date().toISOString();

  const { error: pErr } = await sb.from("deadline_preferences").upsert(
    {
      user_id: uid,
      sort_mode: state.sortMode ?? "dueDate",
      ordered_task_ids: state.orderedTaskIds ?? [],
      recent_courses: state.recentCourses,
      language: state.language,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (pErr) return { error: new Error(pErr.message) };

  const localIds = new Set(state.tasks.map((t) => t.id));

  for (const task of state.tasks) {
    let payload = { ...task };
    if (!payload.dueAtUtc) {
      const d = new Date(payload.dueAt);
      if (!Number.isNaN(d.getTime())) {
        payload = { ...payload, dueAtUtc: d.toISOString() };
      }
    }
    const rowUpdated = task.clientUpdatedAt ?? now;
    const { error } = await sb.from("deadline_tasks").upsert(
      {
        user_id: uid,
        task_id: task.id,
        payload,
        updated_at: rowUpdated,
      },
      { onConflict: "user_id,task_id" },
    );
    if (error) return { error: new Error(error.message) };
  }

  const { data: existingRows, error: listErr } = await sb
    .from("deadline_tasks")
    .select("task_id")
    .eq("user_id", uid);
  if (listErr) return { error: new Error(listErr.message) };

  const toDelete: string[] = [];
  for (const row of existingRows ?? []) {
    const tid = (row as { task_id: string }).task_id;
    if (!localIds.has(tid)) toDelete.push(tid);
  }
  if (toDelete.length > 0) {
    const { error: delErr } = await sb
      .from("deadline_tasks")
      .delete()
      .eq("user_id", uid)
      .in("task_id", toDelete);
    if (delErr) return { error: new Error(delErr.message) };
  }

  clearDeadlineTombstones();

  return { error: null };
}
