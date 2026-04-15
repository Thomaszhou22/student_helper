import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import {
  CloudSyncBadge,
  type CloudSyncUiStatus,
} from "./components/CloudSyncBadge";
import { HubAuthNav } from "./components/HubAuthNav";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
} from "lucide-react";
import {
  clampMinutes,
  countSessionsThisWeek,
  countSessionsToday,
  DEFAULT_BREAK_MIN,
  DEFAULT_FOCUS_MIN,
  formatStudyDuration,
  MAX_MINUTES,
  MIN_MINUTES,
  parseFocusHistory,
  patchStudyTimerStorageClearFocusHistory,
  pruneFocusHistory,
  STUDY_TIMER_STORAGE_KEY,
  sumMinutesToday,
  sumMinutesThisWeek,
  todayKey,
  type FocusSessionRecord,
  type StudyTimerLang,
} from "./studyTimerStats";
import {
  fetchTimerFromCloud,
  loadTimerSyncMeta,
  mergeTimerHistory,
  mergeTimerPrefs,
  pushTimerToCloud,
  saveTimerSyncMeta,
} from "./sync/studyTimerCloudSync";
import { useOnlineSyncRecovery } from "./sync/useOnlineSyncRecovery";

export { STUDY_TIMER_STORAGE_KEY } from "./studyTimerStats";

export type { FocusSessionRecord, StudyTimerLang };

type TimerMode = "focus" | "break";

type TimerPhase = "idle" | "running" | "paused";

type SessionStats = {
  dateKey: string;
  focusCompleted: number;
};

type PersistedTimerState = {
  focusMinutes: number;
  breakMinutes: number;
  mode: TimerMode;
  phase: TimerPhase;
  /** Wall-clock ms when countdown reaches zero (only if phase === "running") */
  endAt: number | null;
  /** Seconds left when paused */
  frozenRemain: number | null;
  statsDateKey: string;
  focusCompletedToday: number;
  focusHistory: FocusSessionRecord[];
};

type Translations = {
  lang: { en: string; zh: string };
  backToHub: string;
  pageTitle: string;
  pageSubtitle: string;
  focus: string;
  break: string;
  start: string;
  pause: string;
  reset: string;
  skip: string;
  settingsTitle: string;
  focusDuration: string;
  breakDuration: string;
  minutesSuffix: string;
  sessionsToday: string;
  todayStudied: string;
  weekStudied: string;
  sessionsCountToday: string;
  sessionsCountWeek: string;
  sessionCompleteFocus: string;
  sessionCompleteBreak: string;
  notifyGranted: string;
  notifyDenied: string;
  notifyButton: string;
  /** Future: link sessions to Deadline Tracker tasks */
  futureTaskLinkHint: string;
  /** Clear all stored focus session history (local + cloud when signed in) */
  clearStudyHistory: string;
  clearStudyHistoryConfirm: string;
};

const translations: Record<StudyTimerLang, Translations> = {
  en: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "Back to hub",
    pageTitle: "Study Timer",
    pageSubtitle: "A simple Pomodoro-style focus timer—stay in flow.",
    focus: "Focus",
    break: "Break",
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    skip: "Skip",
    settingsTitle: "Durations",
    focusDuration: "Focus length",
    breakDuration: "Break length",
    minutesSuffix: "min",
    sessionsToday: "Focus sessions completed today: {count}",
    todayStudied: "Today studied",
    weekStudied: "This week",
    sessionsCountToday: "Sessions today: {count}",
    sessionsCountWeek: "Sessions this week: {count}",
    sessionCompleteFocus: "Focus session complete",
    sessionCompleteBreak: "Break over",
    notifyGranted: "Browser notifications on",
    notifyDenied: "Notifications blocked (check browser settings)",
    notifyButton: "Enable notifications",
    futureTaskLinkHint: "Session links to tasks may arrive in a future update.",
    clearStudyHistory: "Clear study history",
    clearStudyHistoryConfirm:
      "Clear all recorded focus sessions and reset the count for today? This cannot be undone. Other devices will update after sync.",
  },
  zh: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "返回首页",
    pageTitle: "学习计时器",
    pageSubtitle: "简洁的番茄钟式专注计时，保持心流。",
    focus: "专注",
    break: "休息",
    start: "开始",
    pause: "暂停",
    reset: "重置",
    skip: "跳过",
    settingsTitle: "时长设置",
    focusDuration: "专注时长",
    breakDuration: "休息时长",
    minutesSuffix: "分钟",
    sessionsToday: "今日完成专注次数：{count}",
    todayStudied: "今天学习了",
    weekStudied: "本周学习了",
    sessionsCountToday: "今日专注次数：{count}",
    sessionsCountWeek: "本周专注次数：{count}",
    sessionCompleteFocus: "专注时段结束",
    sessionCompleteBreak: "休息结束",
    notifyGranted: "已开启浏览器通知",
    notifyDenied: "通知已被阻止（可在浏览器设置中开启）",
    notifyButton: "请求通知权限",
    futureTaskLinkHint: "未来或将支持与截止日任务关联。",
    clearStudyHistory: "清空累计学习时间",
    clearStudyHistoryConfirm:
      "确定清空所有已记录的专注记录并重置今日次数？此操作无法撤销；登录账号后会同步到其他设备。",
  },
};

function loadPersisted(): PersistedTimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDY_TIMER_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const focusMinutes = clampMinutes(
      typeof o.focusMinutes === "number" ? o.focusMinutes : DEFAULT_FOCUS_MIN,
    );
    const breakMinutes = clampMinutes(
      typeof o.breakMinutes === "number" ? o.breakMinutes : DEFAULT_BREAK_MIN,
    );
    const mode = o.mode === "break" ? "break" : "focus";
    const phase =
      o.phase === "running" || o.phase === "paused" ? o.phase : "idle";
    const endAt =
      typeof o.endAt === "number" && Number.isFinite(o.endAt) ? o.endAt : null;
    const frozenRemain =
      typeof o.frozenRemain === "number" && o.frozenRemain >= 0
        ? Math.floor(o.frozenRemain)
        : null;
    const today = todayKey(new Date());
    let statsDateKey =
      typeof o.statsDateKey === "string" ? o.statsDateKey : today;
    let focusCompletedToday =
      typeof o.focusCompletedToday === "number" && o.focusCompletedToday >= 0
        ? o.focusCompletedToday
        : 0;
    if (statsDateKey !== today) {
      statsDateKey = today;
      focusCompletedToday = 0;
    }
    const focusHistory = parseFocusHistory(o.focusHistory);
    return {
      focusMinutes,
      breakMinutes,
      mode,
      phase,
      endAt,
      frozenRemain,
      statsDateKey,
      focusCompletedToday,
      focusHistory,
    };
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedTimerState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function playSessionEndChime(): void {
  try {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    ctx.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}

function tryNotify(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, silent: false });
  } catch {
    /* ignore */
  }
}

// —— UI ——————————————————————————————————————————————————————————

function LanguageToggle({
  language,
  setLanguage,
  t,
}: {
  language: StudyTimerLang;
  setLanguage: (l: StudyTimerLang) => void;
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
}: {
  t: Translations;
  language: StudyTimerLang;
  setLanguage: (l: StudyTimerLang) => void;
  cloudSync: CloudSyncUiStatus;
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
              <Timer className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              {t.pageTitle}
            </span>
          </div>
          <div className="hidden sm:block">
            <CloudSyncBadge status={cloudSync} lang={language} />
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
        <CloudSyncBadge status={cloudSync} lang={language} />
      </div>
    </header>
  );
}

export function StudyTimerPage() {
  const persistedInit = useMemo(() => loadPersisted(), []);
  const [language, setLanguage] = useState<StudyTimerLang>("en");
  const [focusMinutes, setFocusMinutes] = useState(
    persistedInit?.focusMinutes ?? DEFAULT_FOCUS_MIN,
  );
  const [breakMinutes, setBreakMinutes] = useState(
    persistedInit?.breakMinutes ?? DEFAULT_BREAK_MIN,
  );
  const [mode, setMode] = useState<TimerMode>(
    persistedInit?.mode ?? "focus",
  );
  const [phase, setPhase] = useState<TimerPhase>(
    persistedInit?.phase ?? "idle",
  );
  const [endAt, setEndAt] = useState<number | null>(
    persistedInit?.endAt ?? null,
  );
  const [frozenRemain, setFrozenRemain] = useState<number | null>(
    persistedInit?.frozenRemain ?? null,
  );
  const [sessionStats, setSessionStats] = useState<SessionStats>(() => ({
    dateKey: persistedInit?.statsDateKey ?? todayKey(new Date()),
    focusCompleted: persistedInit?.focusCompletedToday ?? 0,
  }));
  const [focusHistory, setFocusHistory] = useState<FocusSessionRecord[]>(
    () => persistedInit?.focusHistory ?? [],
  );
  const [summaryTick, setSummaryTick] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [notifyHint, setNotifyHint] = useState<string | null>(null);

  const completedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setSummaryTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const t = translations[language];

  const { user, loading: authLoading, supabaseReady } = useAuth();
  const [syncPhase, setSyncPhase] = useState<"syncing" | "synced" | "error">(
    "synced",
  );
  const cloudSyncDisplay = useMemo((): CloudSyncUiStatus => {
    if (!supabaseReady) return "unavailable";
    if (!user) return "local_only";
    return syncPhase;
  }, [supabaseReady, user, syncPhase]);

  const lastTimerSyncUserRef = useRef<string | null>(null);
  const [timerCloudHydrated, setTimerCloudHydrated] = useState(false);

  const timerSyncRef = useRef({
    focusMinutes: persistedInit?.focusMinutes ?? DEFAULT_FOCUS_MIN,
    breakMinutes: persistedInit?.breakMinutes ?? DEFAULT_BREAK_MIN,
    focusHistory: persistedInit?.focusHistory ?? ([] as FocusSessionRecord[]),
  });
  useEffect(() => {
    timerSyncRef.current = { focusMinutes, breakMinutes, focusHistory };
  }, [focusMinutes, breakMinutes, focusHistory]);

  useEffect(() => {
    if (!user) {
      setTimerCloudHydrated(false);
      lastTimerSyncUserRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    saveTimerSyncMeta({ prefsUpdatedAt: new Date().toISOString() });
  }, [focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!supabaseReady || authLoading || !user) {
      if (!user) lastTimerSyncUserRef.current = null;
      return;
    }
    if (lastTimerSyncUserRef.current === user.id) return;
    lastTimerSyncUserRef.current = user.id;
    let cancelled = false;

    void (async () => {
      setSyncPhase("syncing");
      const localMeta = loadTimerSyncMeta();
      const snap = timerSyncRef.current;
      const { prefs, sessions, error } = await fetchTimerFromCloud(user);
      if (cancelled) return;
      if (error) {
        setSyncPhase("error");
        setTimerCloudHydrated(true);
        return;
      }
      const mergedHistory = mergeTimerHistory(snap.focusHistory, sessions);
      const prefsMerged = mergeTimerPrefs(
        snap.focusMinutes,
        snap.breakMinutes,
        localMeta,
        snap.focusHistory.length > 0,
        prefs,
      );
      if (cancelled) return;
      setFocusMinutes(prefsMerged.focusMinutes);
      setBreakMinutes(prefsMerged.breakMinutes);
      setFocusHistory(mergedHistory);
      saveTimerSyncMeta({ prefsUpdatedAt: new Date().toISOString() });
      const { error: pushErr } = await pushTimerToCloud(
        user,
        prefsMerged.focusMinutes,
        prefsMerged.breakMinutes,
        mergedHistory,
      );
      if (cancelled) return;
      setTimerCloudHydrated(true);
      setSyncPhase(pushErr ? "error" : "synced");
    })();

    return () => {
      cancelled = true;
      lastTimerSyncUserRef.current = null;
    };
  }, [user, authLoading, supabaseReady]);

  useEffect(() => {
    if (!supabaseReady || !user || authLoading || !timerCloudHydrated) return;
    const id = window.setTimeout(() => {
      const snap = timerSyncRef.current;
      setSyncPhase("syncing");
      void pushTimerToCloud(
        user,
        snap.focusMinutes,
        snap.breakMinutes,
        snap.focusHistory,
      ).then(({ error }) => setSyncPhase(error ? "error" : "synced"));
    }, 1000);
    return () => clearTimeout(id);
  }, [
    focusMinutes,
    breakMinutes,
    focusHistory,
    user,
    supabaseReady,
    authLoading,
    timerCloudHydrated,
  ]);

  const retryTimerCloudSync = useCallback(() => {
    if (!user || !supabaseReady) return;
    setSyncPhase("syncing");
    const snap = timerSyncRef.current;
    void pushTimerToCloud(
      user,
      snap.focusMinutes,
      snap.breakMinutes,
      snap.focusHistory,
    ).then(({ error }) => setSyncPhase(error ? "error" : "synced"));
  }, [user, supabaseReady]);

  const clearAccumulatedStudyTime = useCallback(() => {
    if (phase !== "idle") return;
    if (!window.confirm(translations[language].clearStudyHistoryConfirm)) return;
    patchStudyTimerStorageClearFocusHistory();
    setFocusHistory([]);
    setSessionStats({
      dateKey: todayKey(new Date()),
      focusCompleted: 0,
    });
    saveTimerSyncMeta({ prefsUpdatedAt: new Date().toISOString() });
  }, [phase, language]);

  useOnlineSyncRecovery({
    enabled: Boolean(user && supabaseReady && timerCloudHydrated),
    isError: syncPhase === "error",
    onRetry: retryTimerCloudSync,
  });

  const baseDurationSec = useMemo(
    () => (mode === "focus" ? focusMinutes * 60 : breakMinutes * 60),
    [mode, focusMinutes, breakMinutes],
  );

  const remainingSec = useMemo(() => {
    if (phase === "running" && endAt != null) {
      return Math.max(0, Math.ceil((endAt - nowTick) / 1000));
    }
    if (phase === "paused" && frozenRemain != null) {
      return frozenRemain;
    }
    return baseDurationSec;
  }, [phase, endAt, frozenRemain, nowTick, baseDurationSec]);

  const progress = useMemo(() => {
    if (baseDurationSec <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - remainingSec / baseDurationSec));
  }, [remainingSec, baseDurationSec]);

  const mmss = useMemo(() => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingSec]);

  const studySummaryNow = useMemo(() => {
    void summaryTick;
    return new Date();
  }, [focusHistory, summaryTick]);

  const minutesStudiedToday = useMemo(
    () => sumMinutesToday(focusHistory, studySummaryNow),
    [focusHistory, studySummaryNow],
  );
  const minutesStudiedWeek = useMemo(
    () => sumMinutesThisWeek(focusHistory, studySummaryNow),
    [focusHistory, studySummaryNow],
  );

  /** Elapsed time in the current focus session (running/paused), for live summary. */
  const inProgressFocusElapsedMinutes = useMemo(() => {
    if (mode !== "focus") return 0;
    if (phase !== "running" && phase !== "paused") return 0;
    const totalSec = focusMinutes * 60;
    const elapsedSec = Math.max(0, totalSec - remainingSec);
    return elapsedSec / 60;
  }, [mode, phase, focusMinutes, remainingSec]);

  const displayMinutesToday =
    minutesStudiedToday + inProgressFocusElapsedMinutes;
  const displayMinutesWeek =
    minutesStudiedWeek + inProgressFocusElapsedMinutes;

  const sessionsTodayCount = useMemo(
    () => countSessionsToday(focusHistory, studySummaryNow),
    [focusHistory, studySummaryNow],
  );
  const sessionsWeekCount = useMemo(
    () => countSessionsThisWeek(focusHistory, studySummaryNow),
    [focusHistory, studySummaryNow],
  );

  const persistSnapshot = useCallback((): PersistedTimerState => {
    return {
      focusMinutes: clampMinutes(focusMinutes),
      breakMinutes: clampMinutes(breakMinutes),
      mode,
      phase,
      endAt,
      frozenRemain,
      statsDateKey: sessionStats.dateKey,
      focusCompletedToday: sessionStats.focusCompleted,
      focusHistory: pruneFocusHistory(focusHistory),
    };
  }, [
    focusMinutes,
    breakMinutes,
    mode,
    phase,
    endAt,
    frozenRemain,
    sessionStats.dateKey,
    sessionStats.focusCompleted,
    focusHistory,
  ]);

  useEffect(() => {
    savePersisted(persistSnapshot());
  }, [persistSnapshot]);

  const completeSession = useCallback(() => {
    const wasFocus = mode === "focus";
    const lang = language;
    const title = wasFocus ? t.sessionCompleteFocus : t.sessionCompleteBreak;
    const body =
      wasFocus
        ? lang === "zh"
          ? "休息一下。"
          : "Time for a break."
        : lang === "zh"
          ? "继续专注。"
          : "Ready to focus again.";

    playSessionEndChime();
    tryNotify(title, body);

    const today = todayKey(new Date());
    setSessionStats((s) => {
      if (s.dateKey !== today) {
        return {
          dateKey: today,
          focusCompleted: wasFocus ? 1 : 0,
        };
      }
      return {
        dateKey: today,
        focusCompleted: wasFocus ? s.focusCompleted + 1 : s.focusCompleted,
      };
    });

    if (wasFocus) {
      const dm = clampMinutes(focusMinutes);
      setFocusHistory((h) =>
        pruneFocusHistory([
          ...h,
          { completedAt: Date.now(), durationMinutes: dm },
        ]),
      );
    }

    setMode((m) => (m === "focus" ? "break" : "focus"));
    setPhase("idle");
    setEndAt(null);
    setFrozenRemain(null);
    completedRef.current = false;
  }, [
    focusMinutes,
    language,
    mode,
    t.sessionCompleteBreak,
    t.sessionCompleteFocus,
  ]);

  useEffect(() => {
    if (phase !== "running" || endAt == null) return;

    const tick = () => {
      const tNow = Date.now();
      setNowTick(tNow);
      if (tNow >= endAt && !completedRef.current) {
        completedRef.current = true;
        completeSession();
      }
    };

    if (Date.now() >= endAt) {
      tick();
      return;
    }

    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, endAt, completeSession]);

  const startOrResume = useCallback(() => {
    if (phase === "running") return;
    const tNow = Date.now();
    if (phase === "paused" && frozenRemain != null && frozenRemain > 0) {
      const sec = Math.min(frozenRemain, baseDurationSec);
      setEndAt(tNow + sec * 1000);
      setFrozenRemain(null);
      setPhase("running");
      completedRef.current = false;
      setNowTick(tNow);
      return;
    }
    const sec = baseDurationSec;
    if (sec <= 0) return;
    setEndAt(tNow + sec * 1000);
    setFrozenRemain(null);
    setPhase("running");
    completedRef.current = false;
    setNowTick(tNow);
  }, [phase, frozenRemain, baseDurationSec]);

  const pause = useCallback(() => {
    if (phase !== "running" || endAt == null) return;
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    setFrozenRemain(left);
    setEndAt(null);
    setPhase("paused");
    setNowTick(Date.now());
  }, [phase, endAt]);

  /**
   * Persist elapsed focus time when user resets/skips mid-session so daily/week
   * totals do not drop to zero (history + in-progress display stay aligned).
   */
  const recordPartialFocusElapsedToHistory = useCallback(() => {
    if (mode !== "focus") return;
    if (phase !== "running" && phase !== "paused") return;
    const totalSec = focusMinutes * 60;
    const elapsedSec = Math.max(0, totalSec - remainingSec);
    if (elapsedSec < 30) return;
    const dmRaw = Math.round(elapsedSec / 60);
    const dm = Math.max(1, clampMinutes(dmRaw));
    const today = todayKey(new Date());
    setFocusHistory((h) =>
      pruneFocusHistory([
        ...h,
        { completedAt: Date.now(), durationMinutes: dm },
      ]),
    );
    setSessionStats((s) => {
      if (s.dateKey !== today) {
        return { dateKey: today, focusCompleted: 1 };
      }
      return {
        dateKey: today,
        focusCompleted: s.focusCompleted + 1,
      };
    });
  }, [mode, phase, focusMinutes, remainingSec]);

  const reset = useCallback(() => {
    recordPartialFocusElapsedToHistory();
    setPhase("idle");
    setEndAt(null);
    setFrozenRemain(null);
    completedRef.current = false;
    setNowTick(Date.now());
  }, [recordPartialFocusElapsedToHistory]);

  const skip = useCallback(() => {
    if (mode === "focus") {
      recordPartialFocusElapsedToHistory();
    }
    setPhase("idle");
    setEndAt(null);
    setFrozenRemain(null);
    completedRef.current = false;
    setMode((m) => (m === "focus" ? "break" : "focus"));
    setNowTick(Date.now());
  }, [mode, recordPartialFocusElapsedToHistory]);

  const requestNotifications = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") setNotifyHint(t.notifyGranted);
    else setNotifyHint(t.notifyDenied);
  }, [t.notifyDenied, t.notifyGranted]);

  const onFocusMinChange = (v: number) => {
    const c = clampMinutes(v);
    setFocusMinutes(c);
    if (phase === "idle" && mode === "focus") {
      setFrozenRemain(null);
    }
    if (phase === "paused" && mode === "focus") {
      setFrozenRemain((fr) =>
        fr == null ? null : Math.min(fr, c * 60),
      );
    }
  };

  const onBreakMinChange = (v: number) => {
    const c = clampMinutes(v);
    setBreakMinutes(c);
    if (phase === "idle" && mode === "break") {
      setFrozenRemain(null);
    }
    if (phase === "paused" && mode === "break") {
      setFrozenRemain((fr) =>
        fr == null ? null : Math.min(fr, c * 60),
      );
    }
  };

  const ringR = 120;
  const ringC = 2 * Math.PI * ringR;
  const dashOffset = ringC * (1 - progress);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <PageHeader
        t={t}
        language={language}
        setLanguage={setLanguage}
        cloudSync={cloudSyncDisplay}
      />

      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 text-slate-600">{t.pageSubtitle}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <p
            className={`text-center text-sm font-bold uppercase tracking-widest ${
              mode === "focus" ? "text-blue-700" : "text-emerald-700"
            }`}
          >
            {mode === "focus" ? t.focus : t.break}
          </p>

          <div className="relative mx-auto mt-6 flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 260 260"
              aria-hidden
            >
              <circle
                cx="130"
                cy="130"
                r={ringR}
                fill="none"
                className="stroke-slate-100"
                strokeWidth="10"
              />
              <circle
                cx="130"
                cy="130"
                r={ringR}
                fill="none"
                className={
                  mode === "focus"
                    ? "stroke-blue-500 transition-[stroke-dashoffset] duration-300 ease-linear"
                    : "stroke-emerald-500 transition-[stroke-dashoffset] duration-300 ease-linear"
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <p
              className="relative text-5xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-6xl"
              aria-live="polite"
            >
              {mmss}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={phase === "running" ? pause : startOrResume}
              className="inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
            >
              {phase === "running" ? (
                <>
                  <Pause className="h-4 w-4" strokeWidth={2} />
                  {t.pause}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" strokeWidth={2} />
                  {t.start}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2} />
              {t.reset}
            </button>
            <button
              type="button"
              onClick={skip}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              title={t.skip}
            >
              <SkipForward className="h-4 w-4" strokeWidth={2} />
              {t.skip}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-blue-100/80 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.todayStudied}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
              {formatStudyDuration(displayMinutesToday, language)}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {t.sessionsCountToday.replace(
                "{count}",
                String(sessionsTodayCount),
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-blue-100/80 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.weekStudied}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
              {formatStudyDuration(displayMinutesWeek, language)}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {t.sessionsCountWeek.replace(
                "{count}",
                String(sessionsWeekCount),
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={phase !== "idle"}
            onClick={clearAccumulatedStudyTime}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600/90 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.clearStudyHistory}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.settingsTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                {t.focusDuration}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  value={focusMinutes}
                  onChange={(e) =>
                    onFocusMinChange(Number(e.target.value))
                  }
                  disabled={phase === "running"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-blue-500/30 focus:ring-2 disabled:opacity-50"
                />
                <span className="shrink-0 text-sm text-slate-500">
                  {t.minutesSuffix}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                {t.breakDuration}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  value={breakMinutes}
                  onChange={(e) =>
                    onBreakMinChange(Number(e.target.value))
                  }
                  disabled={phase === "running"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-blue-500/30 focus:ring-2 disabled:opacity-50"
                />
                <span className="shrink-0 text-sm text-slate-500">
                  {t.minutesSuffix}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm font-medium text-slate-600">
            {t.sessionsToday.replace(
              "{count}",
              String(sessionStats.focusCompleted),
            )}
          </p>

          <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={requestNotifications}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              {t.notifyButton}
            </button>
            {notifyHint ? (
              <p className="text-center text-xs text-slate-500">{notifyHint}</p>
            ) : null}
            <p className="text-center text-[11px] text-slate-400">
              {t.futureTaskLinkHint}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
