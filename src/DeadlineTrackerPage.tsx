import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, Ref } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import {
  CloudSyncBadge,
  type CloudSyncUiStatus,
} from "./components/CloudSyncBadge";
import { HubAuthNav } from "./components/HubAuthNav";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  GripVertical,
  LayoutList,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeadlineReminderSettings } from "./components/DeadlineReminderSettings";
import {
  addDeadlineTaskTombstone,
  bumpDeadlinePrefsMeta,
  fetchDeadlineFromCloud,
  loadDeadlineSyncMeta,
  mergeDeadlineState,
  pushDeadlineToCloud,
  saveDeadlineSyncMeta,
  type PersistedDeadlineShape,
} from "./sync/deadlineCloudSync";
import { useOnlineSyncRecovery } from "./sync/useOnlineSyncRecovery";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";

// —— Types ————————————————————————————————————————————————————————

export type DeadlineLang = "en" | "zh";

export type TaskCategory =
  | "homework"
  | "exam"
  | "application"
  | "personal"
  | "other";

export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "active" | "completed";

export type DeadlineTask = {
  id: string;
  title: string;
  category: TaskCategory;
  /** ISO-like string from datetime-local, e.g. 2026-04-20T14:30 */
  dueAt: string;
  /** UTC instant for server-side reminders (derived from local dueAt) */
  dueAtUtc?: string;
  priority: TaskPriority;
  notes: string;
  status: TaskStatus;
  relatedCourse?: string;
  /** ISO timestamp — last client edit; used for cloud sync merge */
  clientUpdatedAt?: string;
};

export type DeadlineFilter = "all" | "active" | "completed" | "overdue";

export type DeadlineViewMode = "list" | "calendar";

/** List sort: automatic by deadline vs user-defined manual order (drag-and-drop). */
export type DeadlineSortMode = "dueDate" | "manual";

export type UrgencyLevel = "normal" | "soon" | "urgent" | "overdue";

type Translations = {
  lang: { en: string; zh: string };
  backToHub: string;
  pageTitle: string;
  pageSubtitle: string;
  addTask: string;
  updateTask: string;
  cancelEdit: string;
  taskTitle: string;
  taskTitlePlaceholder: string;
  category: string;
  due: string;
  priority: string;
  notes: string;
  notesPlaceholder: string;
  relatedCourse: string;
  relatedCoursePlaceholder: string;
  categories: Record<TaskCategory, string>;
  priorities: Record<TaskPriority, string>;
  filters: Record<DeadlineFilter, string>;
  stats: {
    total: string;
    upcoming: string;
    overdue: string;
    completed: string;
  };
  markComplete: string;
  markActive: string;
  edit: string;
  delete: string;
  statusActive: string;
  statusCompleted: string;
  emptyList: string;
  titleRequired: string;
  urgency: Record<UrgencyLevel, string>;
  suggestionsRecent: string;
  suggestionsFromGpa: string;
  suggestionsNoMatch: string;
  viewList: string;
  viewCalendar: string;
  calToday: string;
  calPrev: string;
  calNext: string;
  tasksForDate: string;
  noTasksForDate: string;
  moreTasks: string;
  monthNoDeadlines: string;
  /** Sun–Sat, index 0 = Sunday */
  weekdaysShort: readonly string[];
  sortBy: string;
  sortManual: string;
  sortDragLabel: string;
  /** Shown above the list in Manual sort mode */
  sortManualHint: string;
  /** Tooltip on disabled grip when sorting by due date */
  sortDueDateDragDisabled: string;
};

const translations: Record<DeadlineLang, Translations> = {
  en: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "Back to hub",
    pageTitle: "Deadline Tracker",
    pageSubtitle:
      "Track assignments, exams, and applications in one calm place.",
    addTask: "Add Task",
    updateTask: "Update Task",
    cancelEdit: "Cancel",
    taskTitle: "Task title",
    taskTitlePlaceholder: "e.g. History essay draft",
    category: "Category",
    due: "Due date",
    priority: "Priority",
    notes: "Notes",
    notesPlaceholder: "Optional details…",
    relatedCourse: "Related Course",
    relatedCoursePlaceholder: "e.g. AP World History",
    categories: {
      homework: "Homework",
      exam: "Exam",
      application: "Application",
      personal: "Personal",
      other: "Other",
    },
    priorities: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    filters: {
      all: "All",
      active: "Active",
      completed: "Completed",
      overdue: "Overdue",
    },
    stats: {
      total: "Total Tasks",
      upcoming: "Upcoming",
      overdue: "Overdue",
      completed: "Completed",
    },
    markComplete: "Mark Complete",
    markActive: "Mark Active",
    edit: "Edit",
    delete: "Delete",
    statusActive: "Active",
    statusCompleted: "Completed",
    emptyList: "No tasks match this filter. Add one above.",
    titleRequired: "Please enter a task title.",
    urgency: {
      normal: "Normal",
      soon: "Soon",
      urgent: "Urgent",
      overdue: "Overdue",
    },
    suggestionsRecent: "Recent",
    suggestionsFromGpa: "From GPA",
    suggestionsNoMatch: "No matching courses",
    viewList: "List",
    viewCalendar: "Calendar",
    calToday: "Today",
    calPrev: "Previous",
    calNext: "Next",
    tasksForDate: "Tasks for {date}",
    noTasksForDate: "No tasks for this date",
    moreTasks: "+{count} more",
    monthNoDeadlines: "No deadlines in this month with the current filter.",
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    sortBy: "Sort by",
    sortManual: "Manual",
    sortDragLabel: "Drag to reorder",
    sortManualHint: "Drag tasks to reorder",
    sortDueDateDragDisabled: "Switch to Manual to reorder",
  },
  zh: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "返回首页",
    pageTitle: "Deadline 追踪器",
    pageSubtitle: "在同一处管理作业、考试与申请截止日。",
    addTask: "添加任务",
    updateTask: "更新任务",
    cancelEdit: "取消",
    taskTitle: "任务标题",
    taskTitlePlaceholder: "例如：历史小论文初稿",
    category: "分类",
    due: "截止时间",
    priority: "优先级",
    notes: "备注",
    notesPlaceholder: "可选补充说明…",
    relatedCourse: "关联课程",
    relatedCoursePlaceholder: "例如：AP世界史",
    categories: {
      homework: "作业",
      exam: "考试",
      application: "申请",
      personal: "个人",
      other: "其他",
    },
    priorities: {
      low: "低",
      medium: "中",
      high: "高",
    },
    filters: {
      all: "全部",
      active: "进行中",
      completed: "已完成",
      overdue: "已逾期",
    },
    stats: {
      total: "全部任务",
      upcoming: "即将到期",
      overdue: "已逾期",
      completed: "已完成",
    },
    markComplete: "标记完成",
    markActive: "标记为进行中",
    edit: "编辑",
    delete: "删除",
    statusActive: "进行中",
    statusCompleted: "已完成",
    emptyList: "没有符合该筛选的任务，请在上方添加。",
    titleRequired: "请填写任务标题。",
    urgency: {
      normal: "正常",
      soon: "即将到期",
      urgent: "紧急",
      overdue: "已逾期",
    },
    suggestionsRecent: "最近使用",
    suggestionsFromGpa: "来自 GPA",
    suggestionsNoMatch: "没有匹配的课程",
    viewList: "列表",
    viewCalendar: "日历",
    calToday: "今天",
    calPrev: "上个月",
    calNext: "下个月",
    tasksForDate: "{date} 的任务",
    noTasksForDate: "这一天没有任务",
    moreTasks: "还有 {count} 项",
    monthNoDeadlines: "在当前筛选下，本月没有截止任务。",
    weekdaysShort: ["日", "一", "二", "三", "四", "五", "六"],
    sortBy: "排序方式",
    sortManual: "手动排序",
    sortDragLabel: "拖动排序",
    sortManualHint: "拖拽任务可调整顺序",
    sortDueDateDragDisabled: "切换到手动排序后可拖拽",
  },
};

export const DEADLINE_STORAGE_KEY = "student-tools-deadline-tracker";

/** Read-only; matches GPA calculator persistence (do not import GPA page to avoid heavy deps). */
const GPA_CALCULATOR_STORAGE_KEY = "student-tools-gpa-calculator";

export type PersistedDeadlineState = {
  tasks: DeadlineTask[];
  language: DeadlineLang;
  recentCourses: string[];
  sortMode?: DeadlineSortMode;
  /** Global manual order; used when sortMode is `manual`. */
  orderedTaskIds?: string[];
};

const CATEGORY_ORDER: TaskCategory[] = [
  "homework",
  "exam",
  "application",
  "personal",
  "other",
];

const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high"];

const FILTER_ORDER: DeadlineFilter[] = [
  "all",
  "active",
  "completed",
  "overdue",
];

function newTaskId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withClientEditTime(t: DeadlineTask): DeadlineTask {
  const d = parseDueDate(t.dueAt);
  return {
    ...t,
    clientUpdatedAt: new Date().toISOString(),
    dueAtUtc: d.toISOString(),
  };
}

export function parseDueDate(dueAt: string): Date {
  const d = new Date(dueAt);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function isTaskOverdue(task: DeadlineTask, now: Date = new Date()): boolean {
  if (task.status === "completed") return false;
  return parseDueDate(task.dueAt).getTime() < now.getTime();
}

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const URGENT_WINDOW_HOURS = 24;
const SOON_WINDOW_DAYS = 3;

/** Time-based urgency for active tasks; completed tasks are always `normal`. */
export function getUrgencyLevel(task: DeadlineTask, now: Date): UrgencyLevel {
  if (task.status === "completed") return "normal";
  const dueMs = parseDueDate(task.dueAt).getTime();
  const nowMs = now.getTime();
  if (dueMs < nowMs) return "overdue";
  const msLeft = dueMs - nowMs;
  if (msLeft <= URGENT_WINDOW_HOURS * MS_HOUR) return "urgent";
  if (msLeft <= SOON_WINDOW_DAYS * MS_DAY) return "soon";
  return "normal";
}

export type UrgencyTitleIcon = "none" | "warning" | "alert";

export type UrgencyVisual = {
  leftBorderClass: string;
  badgeClass: string;
  titleClass: string;
  titleIcon: UrgencyTitleIcon;
  iconClass: string;
};

/** Tailwind classes for urgency accents (border, badge, title, optional icon). */
export function getUrgencyStyle(level: UrgencyLevel): UrgencyVisual {
  switch (level) {
    case "normal":
      return {
        leftBorderClass: "border-l-slate-300",
        badgeClass:
          "bg-slate-50 text-slate-700 ring-slate-300/90 shadow-sm",
        titleClass: "text-slate-900",
        titleIcon: "none",
        iconClass: "",
      };
    case "soon":
      return {
        leftBorderClass: "border-l-amber-400",
        badgeClass:
          "bg-amber-100 text-amber-950 ring-amber-400/60 shadow-sm",
        titleClass: "text-amber-950/90",
        titleIcon: "none",
        iconClass: "",
      };
    case "urgent":
      return {
        leftBorderClass: "border-l-red-500",
        badgeClass:
          "bg-red-100 text-red-950 ring-red-400/55 shadow-sm",
        titleClass: "text-red-800",
        titleIcon: "warning",
        iconClass: "text-red-600",
      };
    case "overdue":
      return {
        leftBorderClass: "border-l-rose-800",
        badgeClass:
          "bg-rose-100 text-rose-950 ring-rose-400/50 shadow-sm",
        titleClass: "text-rose-900",
        titleIcon: "alert",
        iconClass: "text-rose-800",
      };
  }
}

/**
 * Human-readable relative due time. Bucketing and rounding match the former
 * Intl.RelativeTimeFormat logic (same thresholds and Math.round steps).
 */
export function formatRelativeDueTime(
  task: DeadlineTask,
  now: Date,
  language: DeadlineLang,
): string {
  const due = parseDueDate(task.dueAt);
  const ms = due.getTime() - now.getTime();
  const absMs = Math.abs(ms);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  let signed: number;
  let unit: "minute" | "hour" | "day";

  if (absMs < minute) {
    const s = Math.round(ms / 1000);
    signed = Math.round(s / 60) || (ms < 0 ? -1 : 1);
    unit = "minute";
  } else if (absMs < hour) {
    signed = Math.round(ms / minute);
    unit = "minute";
  } else if (absMs < day) {
    signed = Math.round(ms / hour);
    unit = "hour";
  } else {
    signed = Math.round(ms / day);
    unit = "day";
  }

  const n = Math.abs(signed);
  if (signed === 0) {
    return language === "zh" ? "现在截止" : "Due now";
  }

  const overdue = signed < 0;

  if (language === "zh") {
    if (unit === "minute") {
      return overdue ? `已逾期 ${n} 分钟` : `${n} 分钟后截止`;
    }
    if (unit === "hour") {
      return overdue ? `已逾期 ${n} 小时` : `${n} 小时后截止`;
    }
    return overdue ? `已逾期 ${n} 天` : `${n} 天后截止`;
  }

  if (unit === "minute") {
    return overdue ? `Overdue by ${n} min` : `Due in ${n} min`;
  }
  if (unit === "hour") {
    return overdue ? `Overdue by ${n}h` : `Due in ${n}h`;
  }
  const dayWord = n === 1 ? "day" : "days";
  return overdue ? `Overdue by ${n} ${dayWord}` : `Due in ${n} ${dayWord}`;
}

export function sortTasksForDisplay(tasks: DeadlineTask[], now: Date): DeadlineTask[] {
  const active = tasks.filter((t) => t.status === "active");
  const completed = tasks.filter((t) => t.status === "completed");

  const overdue = active.filter((t) => isTaskOverdue(t, now));
  const upcoming = active.filter((t) => !isTaskOverdue(t, now));

  const byDueAsc = (a: DeadlineTask, b: DeadlineTask) =>
    parseDueDate(a.dueAt).getTime() - parseDueDate(b.dueAt).getTime();

  overdue.sort(byDueAsc);
  upcoming.sort(byDueAsc);
  completed.sort(
    (a, b) => parseDueDate(b.dueAt).getTime() - parseDueDate(a.dueAt).getTime(),
  );

  return [...overdue, ...upcoming, ...completed];
}

export function filterTasks(
  tasks: DeadlineTask[],
  filter: DeadlineFilter,
  now: Date,
): DeadlineTask[] {
  switch (filter) {
    case "all":
      return tasks;
    case "active":
      return tasks.filter((t) => t.status === "active");
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    case "overdue":
      return tasks.filter((t) => isTaskOverdue(t, now));
    default:
      return tasks;
  }
}

/** Keep stored order in sync with current tasks (drop removed ids, append new). */
export function normalizeOrderedTaskIds(
  tasks: DeadlineTask[],
  ordered: string[] | undefined,
): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ordered ?? []) {
    if (ids.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const t of tasks) {
    if (!seen.has(t.id)) {
      out.push(t.id);
      seen.add(t.id);
    }
  }
  return out;
}

/**
 * After reordering only the visible subset (e.g. filtered list), merge back into
 * the full global order without moving hidden tasks.
 */
function mergeVisibleOrderInFullOrder(
  fullOrder: string[],
  visibleSet: Set<string>,
  newVisibleOrder: string[],
): string[] {
  let vi = 0;
  return fullOrder.map((id) => {
    if (visibleSet.has(id)) {
      const next = newVisibleOrder[vi];
      vi += 1;
      return next ?? id;
    }
    return id;
  });
}

/** Local calendar date (YYYY-MM-DD) for a task’s due datetime. */
export function dueDateKey(dueAt: string): string {
  const d = parseDueDate(dueAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateKeyFromLocalYMD(year: number, month0: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

function todayDateKey(now: Date): string {
  return dateKeyFromLocalYMD(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
}

function parseDateKey(key: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return { y, m0: mo, d };
}

function groupTasksByDueDate(tasks: DeadlineTask[]): Map<string, DeadlineTask[]> {
  const map = new Map<string, DeadlineTask[]>();
  for (const task of tasks) {
    const k = dueDateKey(task.dueAt);
    const arr = map.get(k);
    if (arr) arr.push(task);
    else map.set(k, [task]);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        parseDueDate(a.dueAt).getTime() - parseDueDate(b.dueAt).getTime(),
    );
  }
  return map;
}

type CalendarDayAccent = "none" | "done" | "normal" | "soon" | "urgent" | "overdue";

function calendarDayAccent(dayTasks: DeadlineTask[], now: Date): CalendarDayAccent {
  if (dayTasks.length === 0) return "none";
  const active = dayTasks.filter((t) => t.status === "active");
  if (active.length === 0) return "done";
  let hasOverdue = false;
  let hasUrgent = false;
  let hasSoon = false;
  for (const t of active) {
    const u = getUrgencyLevel(t, now);
    if (u === "overdue") hasOverdue = true;
    if (u === "urgent") hasUrgent = true;
    if (u === "soon") hasSoon = true;
  }
  if (hasOverdue) return "overdue";
  if (hasUrgent) return "urgent";
  if (hasSoon) return "soon";
  return "normal";
}

type CalCell = { dateKey: string; inMonth: boolean; dayLabel: number };

function buildMonthGrid(year: number, month0: number): CalCell[] {
  const firstDow = new Date(year, month0, 1).getDay();
  const dim = new Date(year, month0 + 1, 0).getDate();
  const prevYear = month0 === 0 ? year - 1 : year;
  const prevMonth0 = month0 === 0 ? 11 : month0 - 1;
  const prevMonthDays = new Date(prevYear, prevMonth0 + 1, 0).getDate();

  const cells: CalCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    const d = prevMonthDays - firstDow + i + 1;
    cells.push({
      dateKey: dateKeyFromLocalYMD(prevYear, prevMonth0, d),
      inMonth: false,
      dayLabel: d,
    });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({
      dateKey: dateKeyFromLocalYMD(year, month0, d),
      inMonth: true,
      dayLabel: d,
    });
  }
  let nextDay = 1;
  const nextYear = month0 === 11 ? year + 1 : year;
  const nextMonth0 = month0 === 11 ? 0 : month0 + 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      dateKey: dateKeyFromLocalYMD(nextYear, nextMonth0, nextDay),
      inMonth: false,
      dayLabel: nextDay,
    });
    nextDay++;
  }
  return cells;
}

function formatDateKeyLong(key: string, lang: DeadlineLang): string {
  const p = parseDateKey(key);
  if (!p) return key;
  const d = new Date(p.y, p.m0, p.d);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function monthHasFilteredTask(
  tasks: DeadlineTask[],
  year: number,
  month0: number,
): boolean {
  return tasks.some((task) => {
    const d = parseDueDate(task.dueAt);
    return d.getFullYear() === year && d.getMonth() === month0;
  });
}

export function computeDeadlineStats(tasks: DeadlineTask[], now: Date) {
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => isTaskOverdue(t, now)).length;
  const upcoming = tasks.filter(
    (t) => t.status === "active" && !isTaskOverdue(t, now),
  ).length;
  return {
    total: tasks.length,
    upcoming,
    overdue,
    completed,
  };
}

function loadPersistedState(): PersistedDeadlineState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEADLINE_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const language =
      o.language === "zh" || o.language === "en" ? o.language : "en";
    if (!Array.isArray(o.tasks)) return null;
    const tasks: DeadlineTask[] = [];
    for (const item of o.tasks) {
      if (!item || typeof item !== "object") continue;
      const x = item as Record<string, unknown>;
      const id = typeof x.id === "string" ? x.id : newTaskId();
      const title = typeof x.title === "string" ? x.title : "";
      const category = CATEGORY_ORDER.includes(x.category as TaskCategory)
        ? (x.category as TaskCategory)
        : "other";
      const dueAt = typeof x.dueAt === "string" ? x.dueAt : "";
      const priority = PRIORITY_ORDER.includes(x.priority as TaskPriority)
        ? (x.priority as TaskPriority)
        : "medium";
      const notes = typeof x.notes === "string" ? x.notes : "";
      const status =
        x.status === "completed" || x.status === "active"
          ? x.status
          : "active";
      if (!dueAt) continue;
      const relatedRaw =
        typeof x.relatedCourse === "string" ? x.relatedCourse.trim() : "";
      const relatedCourse = relatedRaw || undefined;
      const clientUpdatedAt =
        typeof x.clientUpdatedAt === "string" ? x.clientUpdatedAt : undefined;
      const dueAtUtc =
        typeof x.dueAtUtc === "string" ? x.dueAtUtc : undefined;
      tasks.push({
        id,
        title,
        category,
        dueAt,
        priority,
        notes,
        status,
        ...(relatedCourse ? { relatedCourse } : {}),
        ...(clientUpdatedAt ? { clientUpdatedAt } : {}),
        ...(dueAtUtc ? { dueAtUtc } : {}),
      });
    }
    const recentCourses = parseRecentCoursesFromStorage(o);
    const sortMode: DeadlineSortMode =
      o.sortMode === "manual" || o.sortMode === "dueDate"
        ? o.sortMode
        : "dueDate";
    let orderedTaskIds: string[] | undefined;
    if (Array.isArray(o.orderedTaskIds)) {
      orderedTaskIds = o.orderedTaskIds.filter(
        (x): x is string => typeof x === "string",
      );
    }
    if (
      tasks.length > 0 &&
      (!orderedTaskIds || orderedTaskIds.length === 0)
    ) {
      orderedTaskIds = sortTasksForDisplay(tasks, new Date()).map((t) => t.id);
    }
    return {
      tasks,
      language,
      recentCourses,
      sortMode,
      orderedTaskIds,
    };
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedDeadlineState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function defaultDueInput(): string {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normRelatedCourse(raw: string): string | undefined {
  const s = raw.trim();
  return s || undefined;
}

const MAX_RECENT_COURSES = 8;

function courseKey(s: string): string {
  return s.trim().toLowerCase();
}

function parseRecentCoursesFromStorage(o: Record<string, unknown>): string[] {
  if (!Array.isArray(o.recentCourses)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of o.recentCourses) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    const k = courseKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_RECENT_COURSES) break;
  }
  return out;
}

/** Most recent first, unique by case-insensitive name, capped at MAX_RECENT_COURSES. */
export function mergeRecentCourses(
  prev: readonly string[],
  course: string,
): string[] {
  const t = course.trim();
  if (!t) return [...prev];
  const k = courseKey(t);
  const withoutDup = prev.filter((c) => courseKey(c) !== k);
  return [t, ...withoutDup].slice(0, MAX_RECENT_COURSES);
}

/**
 * Course names from GPA calculator localStorage (read-only). Does not apply GPA
 * defaults when courses are missing — only uses stored `courses[].name`.
 */
export function loadGpaCourseNames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GPA_CALCULATOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const courses = (parsed as Record<string, unknown>).courses;
    if (!Array.isArray(courses)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of courses) {
      if (!item || typeof item !== "object") continue;
      const name = (item as Record<string, unknown>).name;
      if (typeof name !== "string") continue;
      const t = name.trim();
      if (!t) continue;
      const k = courseKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  } catch {
    return [];
  }
}

/** Alias for {@link loadGpaCourseNames}. */
export function getGpaCourseSuggestions(): string[] {
  return loadGpaCourseNames();
}

/**
 * Recent → GPA; deduped by case-insensitive key (recent wins).
 */
export function filterMergedCourseSuggestions(
  query: string,
  recent: readonly string[],
  gpaCourses: readonly string[],
): { recentHits: string[]; gpaHits: string[] } {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { recentHits: [], gpaHits: [] };
  }

  const used = new Set<string>();
  const recentHits: string[] = [];

  for (const c of recent) {
    const t = c.trim();
    if (!t || !t.toLowerCase().includes(q)) continue;
    const k = courseKey(t);
    if (used.has(k)) continue;
    used.add(k);
    recentHits.push(t);
  }

  const gpaHits: string[] = [];
  for (const c of gpaCourses) {
    const t = c.trim();
    if (!t || !t.toLowerCase().includes(q)) continue;
    const k = courseKey(t);
    if (used.has(k)) continue;
    used.add(k);
    gpaHits.push(t);
  }

  return { recentHits, gpaHits };
}

function emptyForm(dueDefault: string) {
  return {
    title: "",
    category: "homework" as TaskCategory,
    dueAt: dueDefault,
    priority: "medium" as TaskPriority,
    notes: "",
    relatedCourse: "",
  };
}

// —— UI pieces —————————————————————————————————————————————————————

function RelatedCourseInput({
  label,
  placeholder,
  recentGroupLabel,
  gpaGroupLabel,
  noMatchesLabel,
  recentCourses,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  recentGroupLabel: string;
  gpaGroupLabel: string;
  noMatchesLabel: string;
  recentCourses: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [gpaCourseNames, setGpaCourseNames] = useState<string[]>(() =>
    loadGpaCourseNames(),
  );

  useEffect(() => {
    const refresh = () => setGpaCourseNames(loadGpaCourseNames());
    const onStorage = (e: StorageEvent) => {
      if (e.key === GPA_CALCULATOR_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { recentHits, gpaHits } = useMemo(
    () =>
      filterMergedCourseSuggestions(value, recentCourses, gpaCourseNames),
    [value, recentCourses, gpaCourseNames],
  );
  const flatSuggestions = useMemo(
    () => [...recentHits, ...gpaHits],
    [recentHits, gpaHits],
  );
  const flatKey = useMemo(
    () => flatSuggestions.join("\0"),
    [flatSuggestions],
  );
  const hasQuery = value.trim().length > 0;
  const showPanel = open && hasQuery;
  const hasMatches = flatSuggestions.length > 0;

  const closePanel = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const pick = useCallback(
    (s: string) => {
      onChange(s);
      closePanel();
    },
    [onChange, closePanel],
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [flatKey]);

  useEffect(() => {
    if (!showPanel || highlightedIndex < 0) return;
    document
      .getElementById(`${listId}-opt-${highlightedIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, showPanel, listId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, closePanel]);

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        closePanel();
      }
      return;
    }

    if (!showPanel || flatSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i < 0 ? 0 : (i + 1) % flatSuggestions.length,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i < 0
          ? flatSuggestions.length - 1
          : (i - 1 + flatSuggestions.length) % flatSuggestions.length,
      );
      return;
    }

    if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < flatSuggestions.length) {
        e.preventDefault();
        pick(flatSuggestions[highlightedIndex]);
      }
    }
  };

  const rowClass = (active: boolean) =>
    `w-full px-3 py-2 text-left text-sm font-medium transition ${
      active
        ? "bg-blue-50 text-blue-950"
        : "text-slate-800 hover:bg-slate-50"
    }`;

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={`${listId}-listbox`}
        aria-activedescendant={
          showPanel && hasMatches && highlightedIndex >= 0
            ? `${listId}-opt-${highlightedIndex}`
            : undefined
        }
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
      />
      {showPanel ? (
        <div
          id={`${listId}-listbox`}
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100"
          role="listbox"
        >
          {!hasMatches ? (
            <p
              className="px-3 py-4 text-center text-sm font-medium text-slate-500"
              role="status"
            >
              {noMatchesLabel}
            </p>
          ) : (
            <>
              {recentHits.length > 0 ? (
                <div>
                  <p className="sticky top-0 z-10 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {recentGroupLabel}
                  </p>
                  <ul className="pb-1">
                    {recentHits.map((s, i) => (
                      <li key={`r:${courseKey(s)}`} role="presentation">
                        <button
                          type="button"
                          id={`${listId}-opt-${i}`}
                          role="option"
                          aria-selected={highlightedIndex === i}
                          className={rowClass(highlightedIndex === i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setHighlightedIndex(i)}
                          onClick={() => pick(s)}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {gpaHits.length > 0 ? (
                <div
                  className={
                    recentHits.length > 0 ? "border-t border-slate-100 pt-1" : ""
                  }
                >
                  <p className="sticky top-0 z-10 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {gpaGroupLabel}
                  </p>
                  <ul className="pb-1">
                    {gpaHits.map((s, j) => {
                      const i = recentHits.length + j;
                      return (
                        <li key={`g:${courseKey(s)}:${j}`} role="presentation">
                          <button
                            type="button"
                            id={`${listId}-opt-${i}`}
                            role="option"
                            aria-selected={highlightedIndex === i}
                            className={rowClass(highlightedIndex === i)}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setHighlightedIndex(i)}
                            onClick={() => pick(s)}
                          >
                            {s}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LanguageToggle({
  language,
  setLanguage,
  t,
}: {
  language: DeadlineLang;
  setLanguage: (l: DeadlineLang) => void;
  t: Translations;
}) {
  const pill =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:text-sm";
  const active = "bg-white text-blue-700 shadow-sm";
  const idle = "text-slate-600 hover:text-slate-900";
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-slate-200/90 bg-slate-50/90 p-0.5 shadow-sm">
      <button
        type="button"
        className={`${pill} ${language === "en" ? active : idle}`}
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        {t.lang.en}
      </button>
      <button
        type="button"
        className={`${pill} ${language === "zh" ? active : idle}`}
        aria-pressed={language === "zh"}
        onClick={() => setLanguage("zh")}
      >
        {t.lang.zh}
      </button>
    </div>
  );
}

function PageHeader({
  t,
  language,
  setLanguage,
  cloudSync,
  cloudSyncDetail,
}: {
  t: Translations;
  language: DeadlineLang;
  setLanguage: (l: DeadlineLang) => void;
  cloudSync: CloudSyncUiStatus;
  cloudSyncDetail?: string;
}) {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {t.backToHub}
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-soft">
              <CalendarClock className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              {t.pageTitle}
            </span>
          </div>
          <div className="hidden sm:block">
            <CloudSyncBadge
              status={cloudSync}
              lang={language}
              detail={cloudSyncDetail}
            />
          </div>
          <HubAuthNav lang={language} compact />
          <LanguageToggle
            language={language}
            setLanguage={setLanguage}
            t={t}
          />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-2 sm:hidden sm:px-6">
        <CloudSyncBadge
          status={cloudSync}
          lang={language}
          detail={cloudSyncDetail}
        />
      </div>
    </header>
  );
}

function priorityBadgeClass(p: TaskPriority): string {
  if (p === "high") return "bg-red-50 text-red-800 ring-red-100";
  if (p === "medium") return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

type DeadlineTaskListItemProps = {
  task: DeadlineTask;
  t: Translations;
  language: DeadlineLang;
  liveNow: Date;
  onToggleComplete: (id: string) => void;
  onEdit: (task: DeadlineTask) => void;
  onDelete: (id: string) => void;
  dragHandle?: "none" | "disabled" | "active";
  listRef?: Ref<HTMLLIElement>;
  listStyle?: CSSProperties;
  listClassName?: string;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  isDragging?: boolean;
};

function DeadlineTaskListItem({
  task,
  t,
  language,
  liveNow,
  onToggleComplete,
  onEdit,
  onDelete,
  dragHandle = "none",
  listRef,
  listStyle,
  listClassName,
  dragAttributes,
  dragListeners,
  isDragging,
}: DeadlineTaskListItemProps) {
  const overdue = isTaskOverdue(task, liveNow);
  const completed = task.status === "completed";
  const urgency = getUrgencyLevel(task, liveNow);
  const uStyle = getUrgencyStyle(urgency);
  const handleCol =
    dragHandle === "none" ? null : dragHandle === "disabled" ? (
      <span
        className="inline-flex w-9 shrink-0 cursor-not-allowed select-none justify-center rounded-lg py-1 text-slate-400 opacity-40"
        title={t.sortDueDateDragDisabled}
        aria-label={t.sortDueDateDragDisabled}
        tabIndex={-1}
      >
        <GripVertical className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      </span>
    ) : (
      <button
        type="button"
        className="inline-flex w-9 shrink-0 touch-none cursor-grab select-none justify-center rounded-lg py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label={t.sortDragLabel}
        {...dragAttributes}
        {...dragListeners}
      >
        <GripVertical className="h-5 w-5" strokeWidth={2} />
      </button>
    );
  return (
    <li
      ref={listRef}
      style={listStyle}
      className={`rounded-2xl border border-slate-200/80 border-l-4 bg-white p-5 shadow-sm ring-1 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-50/70 hover:shadow-md active:translate-y-0 active:scale-[0.995] active:shadow-sm ${uStyle.leftBorderClass} ${
        overdue ? "ring-rose-100/80" : "ring-slate-100"
      } ${completed ? "opacity-70" : ""} ${
        isDragging ? "z-10 scale-[1.01] shadow-lg ring-2 ring-blue-400/50" : ""
      } ${listClassName ?? ""} ${dragHandle === "active" ? "select-none" : ""}`}
    >
      <div
        className={handleCol ? "flex gap-3 sm:gap-4" : "flex"}
      >
        {handleCol ? (
          <div className="flex shrink-0 pt-0.5 sm:pt-1">{handleCol}</div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 max-w-full items-start gap-1.5">
                {uStyle.titleIcon === "warning" ? (
                  <TriangleAlert
                    className={`mt-0.5 h-5 w-5 shrink-0 ${uStyle.iconClass}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : uStyle.titleIcon === "alert" ? (
                  <CircleAlert
                    className={`mt-0.5 h-5 w-5 shrink-0 ${uStyle.iconClass}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
                <h3
                  className={`min-w-0 text-lg font-semibold ${
                    completed
                      ? "text-slate-500 line-through"
                      : uStyle.titleClass
                  }`}
                >
                  {task.title}
                </h3>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ring-1 ${uStyle.badgeClass}`}
              >
                {t.urgency[urgency]}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {t.categories[task.category]}
              </span>
              {task.relatedCourse?.trim() ? (
                <span className="max-w-[12rem] truncate rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100 sm:max-w-xs">
                  {task.relatedCourse.trim()}
                </span>
              ) : null}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${priorityBadgeClass(task.priority)}`}
              >
                {t.priorities[task.priority]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  completed
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "bg-sky-50 text-sky-800 ring-1 ring-sky-100"
                }`}
              >
                {completed ? t.statusCompleted : t.statusActive}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(parseDueDate(task.dueAt))}
              <span className="mx-2 text-slate-300">·</span>
              <span
                className={
                  overdue && !completed
                    ? "font-semibold text-red-600"
                    : "font-medium text-slate-700"
                }
              >
                {formatRelativeDueTime(task, liveNow, language)}
              </span>
            </p>
            {task.notes ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {task.notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => onToggleComplete(task.id)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-150 ease-out hover:bg-slate-50 hover:shadow active:scale-[0.98] active:shadow-inner sm:text-sm"
            >
              <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
              {completed ? t.markActive : t.markComplete}
            </button>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-150 ease-out hover:bg-slate-50 hover:shadow active:scale-[0.98] active:shadow-inner sm:text-sm"
            >
              <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} />
              {t.edit}
            </button>
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition-all duration-150 ease-out hover:bg-red-50 hover:shadow active:scale-[0.98] active:shadow-inner sm:text-sm"
            >
              <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} />
              {t.delete}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function SortableDeadlineListItem(
  props: Omit<
    DeadlineTaskListItemProps,
    | "dragHandle"
    | "listRef"
    | "listStyle"
    | "listClassName"
    | "dragAttributes"
    | "dragListeners"
    | "isDragging"
  >,
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <DeadlineTaskListItem
      {...props}
      dragHandle="active"
      listRef={setNodeRef}
      listStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}

function StatCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: number;
  accent?: "blue" | "amber" | "red" | "emerald" | "slate";
}) {
  const ring =
    accent === "blue"
      ? "ring-blue-100"
      : accent === "amber"
        ? "ring-amber-100"
        : accent === "red"
          ? "ring-red-100"
          : accent === "emerald"
            ? "ring-emerald-100"
            : "ring-slate-100";
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 sm:p-5 ${ring}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

// —— Page ——————————————————————————————————————————————————————————

export function DeadlineTrackerPage() {
  const dueDefaultRef = useMemo(() => defaultDueInput(), []);
  const initial = useMemo(() => {
    const loaded = loadPersistedState();
    if (loaded) return loaded;
    return {
      tasks: [] as DeadlineTask[],
      language: "en" as DeadlineLang,
      recentCourses: [] as string[],
      sortMode: "dueDate" as DeadlineSortMode,
      orderedTaskIds: [] as string[],
    };
  }, []);

  const [language, setLanguage] = useState<DeadlineLang>(initial.language);
  const [tasks, setTasks] = useState<DeadlineTask[]>(initial.tasks);
  const [recentCourses, setRecentCourses] = useState<string[]>(
    () => initial.recentCourses,
  );
  const [sortMode, setSortMode] = useState<DeadlineSortMode>(
    () => initial.sortMode ?? "dueDate",
  );
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>(() =>
    normalizeOrderedTaskIds(initial.tasks, initial.orderedTaskIds),
  );
  const [filter, setFilter] = useState<DeadlineFilter>("all");
  const [viewMode, setViewMode] = useState<DeadlineViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth() };
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    todayDateKey(new Date()),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const calendarDetailRef = useRef<HTMLDivElement>(null);
  const prevDeadlineFilter = useRef(filter);
  const prevDeadlineViewMode = useRef(viewMode);

  const [form, setForm] = useState(() => emptyForm(dueDefaultRef));

  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setLiveNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const t = translations[language];
  const { user, loading: authLoading, supabaseReady } = useAuth();
  const [syncPhase, setSyncPhase] = useState<"syncing" | "synced" | "error">(
    "synced",
  );
  const [mergeAccountHint, setMergeAccountHint] = useState(false);

  const cloudSyncDisplay = useMemo((): CloudSyncUiStatus => {
    if (!supabaseReady) return "unavailable";
    if (!user) return "local_only";
    return syncPhase;
  }, [supabaseReady, user, syncPhase]);

  const cloudSyncDetail = useMemo(() => {
    if (!mergeAccountHint || cloudSyncDisplay !== "synced") return undefined;
    return language === "zh"
      ? "已将你现有的数据与账号数据合并"
      : "Merged your existing data with your account";
  }, [mergeAccountHint, cloudSyncDisplay, language]);

  const deadlineSnapshotRef = useRef<PersistedDeadlineShape>({
    tasks: initial.tasks,
    language: initial.language,
    recentCourses: initial.recentCourses,
    sortMode: initial.sortMode ?? "dueDate",
    orderedTaskIds: initial.orderedTaskIds,
  });
  useEffect(() => {
    deadlineSnapshotRef.current = {
      tasks,
      language,
      recentCourses,
      sortMode,
      orderedTaskIds,
    };
  }, [tasks, language, recentCourses, sortMode, orderedTaskIds]);

  const lastSyncedUserRef = useRef<string | null>(null);
  const [deadlineCloudHydrated, setDeadlineCloudHydrated] = useState(false);

  useEffect(() => {
    saveDeadlineSyncMeta({ prefsUpdatedAt: new Date().toISOString() });
  }, [language, sortMode, orderedTaskIds, recentCourses]);

  useEffect(() => {
    if (!user) {
      setDeadlineCloudHydrated(false);
      lastSyncedUserRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    if (!supabaseReady || authLoading || !user) return;
    if (lastSyncedUserRef.current === user.id) return;
    lastSyncedUserRef.current = user.id;
    let cancelled = false;

    void (async () => {
      setSyncPhase("syncing");
      const localMeta = loadDeadlineSyncMeta();
      const localShape = deadlineSnapshotRef.current;
      const { prefs, tasks: cloudRows, error } =
        await fetchDeadlineFromCloud(user);
      if (cancelled) return;
      if (error) {
        setSyncPhase("error");
        setDeadlineCloudHydrated(true);
        return;
      }
      const { merged, didMergeDistinctSources } = mergeDeadlineState(
        localShape,
        localMeta,
        prefs,
        cloudRows,
      );
      if (cancelled) return;
      if (didMergeDistinctSources) setMergeAccountHint(true);
      setTasks(merged.tasks);
      setLanguage(merged.language);
      setRecentCourses(merged.recentCourses);
      setSortMode(merged.sortMode);
      setOrderedTaskIds(
        normalizeOrderedTaskIds(merged.tasks, merged.orderedTaskIds),
      );
      saveDeadlineSyncMeta({ prefsUpdatedAt: new Date().toISOString() });
      const { error: pushErr } = await pushDeadlineToCloud(user, merged);
      if (cancelled) return;
      setDeadlineCloudHydrated(true);
      setSyncPhase(pushErr ? "error" : "synced");
    })();

    return () => {
      cancelled = true;
      lastSyncedUserRef.current = null;
    };
  }, [user, authLoading, supabaseReady]);

  useEffect(() => {
    if (
      !supabaseReady ||
      !user ||
      authLoading ||
      !deadlineCloudHydrated
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      const snap = deadlineSnapshotRef.current;
      setSyncPhase("syncing");
      void pushDeadlineToCloud(user, snap).then(({ error }) => {
        setSyncPhase(error ? "error" : "synced");
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [
    tasks,
    language,
    recentCourses,
    sortMode,
    orderedTaskIds,
    user,
    supabaseReady,
    authLoading,
    deadlineCloudHydrated,
  ]);

  useEffect(() => {
    if (!mergeAccountHint) return;
    const id = window.setTimeout(() => setMergeAccountHint(false), 12_000);
    return () => clearTimeout(id);
  }, [mergeAccountHint]);

  const retryDeadlineCloudSync = useCallback(() => {
    if (!user || !supabaseReady) return;
    setSyncPhase("syncing");
    void pushDeadlineToCloud(user, deadlineSnapshotRef.current).then(
      ({ error }) => {
        setSyncPhase(error ? "error" : "synced");
      },
    );
  }, [user, supabaseReady]);

  useOnlineSyncRecovery({
    enabled: Boolean(user && supabaseReady && deadlineCloudHydrated),
    isError: syncPhase === "error",
    onRetry: retryDeadlineCloudSync,
  });

  useEffect(() => {
    setOrderedTaskIds((prev) => normalizeOrderedTaskIds(tasks, prev));
  }, [tasks]);

  useEffect(() => {
    savePersistedState({
      tasks,
      language,
      recentCourses,
      sortMode,
      orderedTaskIds,
    });
  }, [tasks, language, recentCourses, sortMode, orderedTaskIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const stats = useMemo(
    () => computeDeadlineStats(tasks, liveNow),
    [tasks, liveNow],
  );

  const filteredTasks = useMemo(
    () => filterTasks(tasks, filter, liveNow),
    [tasks, filter, liveNow],
  );

  const listViewTasks = useMemo(() => {
    if (sortMode === "dueDate") {
      return sortTasksForDisplay(filteredTasks, liveNow);
    }
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const filteredSet = new Set(filteredTasks.map((t) => t.id));
    const out: DeadlineTask[] = [];
    for (const id of orderedTaskIds) {
      if (!filteredSet.has(id)) continue;
      const task = taskById.get(id);
      if (task) out.push(task);
    }
    return out;
  }, [sortMode, filteredTasks, tasks, orderedTaskIds, liveNow]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (sortMode !== "manual") return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const visibleIds = listViewTasks.map((t) => t.id);
      const oldIndex = visibleIds.indexOf(String(active.id));
      const newIndex = visibleIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const newVisibleOrder = arrayMove(visibleIds, oldIndex, newIndex);
      const visibleSet = new Set(visibleIds);
      setOrderedTaskIds((prev) =>
        mergeVisibleOrderInFullOrder(prev, visibleSet, newVisibleOrder),
      );
      bumpDeadlinePrefsMeta();
    },
    [sortMode, listViewTasks],
  );

  const tasksByDate = useMemo(
    () => groupTasksByDueDate(filteredTasks),
    [filteredTasks],
  );

  useEffect(() => {
    const filterChanged = prevDeadlineFilter.current !== filter;
    const enteredCalendar =
      prevDeadlineViewMode.current !== "calendar" &&
      viewMode === "calendar";
    prevDeadlineFilter.current = filter;
    prevDeadlineViewMode.current = viewMode;
    if (viewMode !== "calendar") return;
    if (!filterChanged && !enteredCalendar) return;

    const today = todayDateKey(liveNow);
    if (tasksByDate.has(today)) {
      setSelectedDateKey(today);
      const p = parseDateKey(today);
      if (p) setCalendarMonth({ year: p.y, month0: p.m0 });
      return;
    }
    const keys = [...tasksByDate.keys()].sort();
    if (keys.length > 0) {
      const k = keys[0];
      setSelectedDateKey(k);
      const p = parseDateKey(k);
      if (p) setCalendarMonth({ year: p.y, month0: p.m0 });
    } else {
      setSelectedDateKey(today);
      const p = parseDateKey(today);
      if (p) setCalendarMonth({ year: p.y, month0: p.m0 });
    }
  }, [viewMode, filter, tasksByDate, liveNow]);

  useEffect(() => {
    if (viewMode !== "calendar") return;
    calendarDetailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedDateKey, viewMode]);

  const resetForm = useCallback(() => {
    setForm(emptyForm(dueDefaultRef));
    setEditingId(null);
    setFormError("");
  }, [dueDefaultRef]);

  const submitForm = useCallback(() => {
    const title = form.title.trim();
    if (!title) {
      setFormError(t.titleRequired);
      return;
    }
    setFormError("");
    const related = normRelatedCourse(form.relatedCourse);
    if (editingId) {
      setTasks((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? withClientEditTime({
                ...x,
                title,
                category: form.category,
                dueAt: form.dueAt,
                priority: form.priority,
                notes: form.notes.trim(),
                relatedCourse: related,
              })
            : x,
        ),
      );
      if (related) {
        setRecentCourses((prev) => mergeRecentCourses(prev, related));
      }
      resetForm();
      return;
    }
    const task: DeadlineTask = withClientEditTime({
      id: newTaskId(),
      title,
      category: form.category,
      dueAt: form.dueAt,
      priority: form.priority,
      notes: form.notes.trim(),
      status: "active",
      relatedCourse: related,
    });
    setTasks((prev) => [...prev, task]);
    if (related) {
      setRecentCourses((prev) => mergeRecentCourses(prev, related));
    }
    resetForm();
  }, [editingId, form, resetForm, t]);

  const startEdit = useCallback((task: DeadlineTask) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      category: task.category,
      dueAt: task.dueAt.slice(0, 16),
      priority: task.priority,
      notes: task.notes,
      relatedCourse: task.relatedCourse ?? "",
    });
    setFormError("");
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((x) =>
        x.id === id
          ? withClientEditTime({
              ...x,
              status: x.status === "completed" ? "active" : "completed",
            })
          : x,
      ),
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    addDeadlineTaskTombstone(id);
    setTasks((prev) => prev.filter((x) => x.id !== id));
    setEditingId((e) => (e === id ? null : e));
  }, []);

  const selectCalendarCell = useCallback((key: string) => {
    setSelectedDateKey(key);
    const p = parseDateKey(key);
    if (p) setCalendarMonth({ year: p.y, month0: p.m0 });
  }, []);

  const goCalendarToday = useCallback(() => {
    const n = liveNow;
    setCalendarMonth({
      year: n.getFullYear(),
      month0: n.getMonth(),
    });
    setSelectedDateKey(todayDateKey(n));
  }, [liveNow]);

  const calendarCells = useMemo(
    () => buildMonthGrid(calendarMonth.year, calendarMonth.month0),
    [calendarMonth.year, calendarMonth.month0],
  );

  const monthTitle = useMemo(() => {
    const locale = language === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
    }).format(new Date(calendarMonth.year, calendarMonth.month0, 1));
  }, [calendarMonth.year, calendarMonth.month0, language]);

  const monthHasTasks = useMemo(
    () =>
      monthHasFilteredTask(
        filteredTasks,
        calendarMonth.year,
        calendarMonth.month0,
      ),
    [filteredTasks, calendarMonth.year, calendarMonth.month0],
  );

  const selectedDayTasks = tasksByDate.get(selectedDateKey) ?? [];

  const tasksForDateHeading = t.tasksForDate.replace(
    "{date}",
    formatDateKeyLong(selectedDateKey, language),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <PageHeader
        t={t}
        language={language}
        setLanguage={setLanguage}
        cloudSync={cloudSyncDisplay}
        cloudSyncDetail={cloudSyncDetail}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t.pageSubtitle}</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t.stats.total} value={stats.total} accent="slate" />
          <StatCard
            label={t.stats.upcoming}
            value={stats.upcoming}
            accent="blue"
          />
          <StatCard
            label={t.stats.overdue}
            value={stats.overdue}
            accent="red"
          />
          <StatCard
            label={t.stats.completed}
            value={stats.completed}
            accent="emerald"
          />
        </div>

        <DeadlineReminderSettings language={language} />

        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? t.updateTask : t.addTask}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.taskTitle}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder={t.taskTitlePlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.category}
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as TaskCategory,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {t.categories[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.due}
              </label>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueAt: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.priority}
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as TaskPriority,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {t.priorities[p]}
                  </option>
                ))}
              </select>
            </div>
            <RelatedCourseInput
              label={t.relatedCourse}
              placeholder={t.relatedCoursePlaceholder}
              recentGroupLabel={t.suggestionsRecent}
              gpaGroupLabel={t.suggestionsFromGpa}
              noMatchesLabel={t.suggestionsNoMatch}
              recentCourses={recentCourses}
              value={form.relatedCourse}
              onChange={(relatedCourse) =>
                setForm((f) => ({ ...f, relatedCourse }))
              }
            />
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.notes}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={t.notesPlaceholder}
                rows={3}
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              />
            </div>
          </div>
          {formError ? (
            <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitForm}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
            >
              {editingId ? t.updateTask : t.addTask}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {t.cancelEdit}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.filters[f]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <div
              className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2"
              role="group"
              aria-label={t.sortBy}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.sortBy}
              </span>
              <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSortMode("dueDate")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    sortMode === "dueDate"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  aria-pressed={sortMode === "dueDate"}
                >
                  {t.due}
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("manual")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    sortMode === "manual"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  aria-pressed={sortMode === "manual"}
                >
                  {t.sortManual}
                </button>
              </div>
            </div>
            <div
              className="flex justify-center sm:justify-end"
              role="group"
              aria-label={language === "zh" ? "视图" : "View"}
            >
            <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  viewMode === "list"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={viewMode === "list"}
              >
                <LayoutList className="h-4 w-4 shrink-0" strokeWidth={2} />
                {t.viewList}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  viewMode === "calendar"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={viewMode === "calendar"}
              >
                <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={2} />
                {t.viewCalendar}
              </button>
            </div>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          listViewTasks.length === 0 ? (
            <ul className="space-y-4">
              <li className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm font-medium text-slate-500">
                {t.emptyList}
              </li>
            </ul>
          ) : (
            <>
              {sortMode === "manual" ? (
                <p className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                  <GripVertical
                    className="h-4 w-4 shrink-0 text-slate-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>{t.sortManualHint}</span>
                </p>
              ) : null}
              {sortMode === "manual" ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={listViewTasks.map((task) => task.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-4">
                      {listViewTasks.map((task) => (
                        <SortableDeadlineListItem
                          key={task.id}
                          task={task}
                          t={t}
                          language={language}
                          liveNow={liveNow}
                          onToggleComplete={toggleComplete}
                          onEdit={startEdit}
                          onDelete={removeTask}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : (
                <ul className="space-y-4">
                  {listViewTasks.map((task) => (
                    <DeadlineTaskListItem
                      key={task.id}
                      task={task}
                      t={t}
                      language={language}
                      liveNow={liveNow}
                      onToggleComplete={toggleComplete}
                      onEdit={startEdit}
                      onDelete={removeTask}
                      dragHandle="disabled"
                    />
                  ))}
                </ul>
              )}
            </>
          )
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {monthTitle}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((m) => {
                        const next =
                          m.month0 === 0
                            ? { year: m.year - 1, month0: 11 }
                            : { year: m.year, month0: m.month0 - 1 };
                        return next;
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label={t.calPrev}
                    title={t.calPrev}
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    <span className="hidden sm:inline">{t.calPrev}</span>
                  </button>
                  <button
                    type="button"
                    onClick={goCalendarToday}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
                  >
                    {t.calToday}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((m) => {
                        const next =
                          m.month0 === 11
                            ? { year: m.year + 1, month0: 0 }
                            : { year: m.year, month0: m.month0 + 1 };
                        return next;
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label={t.calNext}
                    title={t.calNext}
                  >
                    <span className="hidden sm:inline">{t.calNext}</span>
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div
                className={`mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-slate-500 sm:text-xs ${
                  language === "zh" ? "normal-case" : "uppercase"
                }`}
              >
                {t.weekdaysShort.map((w, i) => (
                  <div key={i} className="py-2">
                    {w}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
                {calendarCells.map((cell, cellIdx) => {
                  const dayTasks = tasksByDate.get(cell.dateKey) ?? [];
                  const count = dayTasks.length;
                  const accent = calendarDayAccent(dayTasks, liveNow);
                  const isToday = cell.dateKey === todayDateKey(liveNow);
                  const isSelected = cell.dateKey === selectedDateKey;
                  const active = dayTasks.filter((x) => x.status === "active");
                  let dotOver = false;
                  let dotUrgent = false;
                  let dotSoon = false;
                  for (const x of active) {
                    const g = getUrgencyLevel(x, liveNow);
                    if (g === "overdue") dotOver = true;
                    if (g === "urgent") dotUrgent = true;
                    if (g === "soon") dotSoon = true;
                  }
                  const accentBg =
                    accent === "overdue"
                      ? "bg-rose-50/90"
                      : accent === "urgent"
                        ? "bg-red-50/80"
                        : accent === "soon"
                          ? "bg-amber-50/85"
                          : accent === "normal"
                            ? "bg-white"
                            : accent === "done"
                              ? "bg-slate-50/90"
                              : "bg-slate-50/50";
                  const muted = !cell.inMonth;
                  return (
                    <button
                      key={`${cellIdx}-${cell.dateKey}`}
                      type="button"
                      onClick={() => selectCalendarCell(cell.dateKey)}
                      className={`flex min-h-[4.5rem] flex-col rounded-xl border p-1.5 text-left shadow-sm ring-1 transition hover:ring-blue-200/80 sm:min-h-[5.5rem] sm:p-2 ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1 ring-offset-white"
                          : "border-slate-200/80 ring-slate-100"
                      } ${accentBg} ${muted ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isToday
                              ? "flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white"
                              : "text-slate-900"
                          }`}
                        >
                          {cell.dayLabel}
                        </span>
                        {count > 0 ? (
                          <span className="shrink-0 rounded-full bg-blue-600/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-blue-800 ring-1 ring-blue-200/50 sm:text-xs">
                            {count}
                          </span>
                        ) : null}
                      </div>
                      {count > 0 ? (
                        <div className="mt-1 flex min-h-[14px] items-center gap-0.5">
                          {dotOver ? (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600"
                              title={t.urgency.overdue}
                            />
                          ) : null}
                          {dotUrgent ? (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                              title={t.urgency.urgent}
                            />
                          ) : null}
                          {dotSoon ? (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                              title={t.urgency.soon}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-0.5 flex min-w-0 flex-1 flex-col gap-0.5">
                        {dayTasks.slice(0, 3).map((task) => {
                          const g = getUrgencyLevel(task, liveNow);
                          return (
                            <p
                              key={task.id}
                              className={`line-clamp-1 text-[9px] font-medium leading-tight sm:text-xs ${
                                task.status === "completed"
                                  ? "text-slate-400 line-through"
                                  : g === "overdue"
                                    ? "text-rose-800"
                                    : g === "urgent"
                                      ? "text-red-800"
                                      : g === "soon"
                                        ? "text-amber-900"
                                        : "text-slate-700"
                              }`}
                            >
                              {task.title}
                            </p>
                          );
                        })}
                      </div>
                      {count > 3 ? (
                        <p className="mt-auto text-[9px] font-semibold text-blue-700 sm:text-[10px]">
                          {t.moreTasks.replace("{count}", String(count - 3))}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {!monthHasTasks ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-sm font-medium text-slate-600">
                  {t.monthNoDeadlines}
                </p>
              ) : null}
            </div>

            <div
              ref={calendarDetailRef}
              className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {tasksForDateHeading}
              </h2>
              <ul className="mt-4 space-y-4">
                {selectedDayTasks.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm font-medium text-slate-500">
                    {t.noTasksForDate}
                  </li>
                ) : (
                  selectedDayTasks.map((task) => (
                    <DeadlineTaskListItem
                      key={task.id}
                      task={task}
                      t={t}
                      language={language}
                      liveNow={liveNow}
                      onToggleComplete={toggleComplete}
                      onEdit={startEdit}
                      onDelete={removeTask}
                    />
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
