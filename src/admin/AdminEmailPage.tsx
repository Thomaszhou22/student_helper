import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { HubAuthNav } from "../components/HubAuthNav";
import { HubLanguageToggle } from "../components/HubLanguageToggle";
import { useHubUiLang, type HubUiLang } from "../context/HubUiLangContext";
import { getSupabase } from "../lib/supabase";

/** Short, opaque user identifier for admin display (privacy-safe) */
function hashUser(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().slice(0, 6);
}

type EmailEvent = {
  user_id: string;
  task_id: string;
  reminder_type: string;
  sent_at: string;
};

type Translations = {
  pageTitle: string;
  backHome: string;
  backToAdmin: string;
  accessDenied: string;
  user: string;
  date: string;
  time: string;
  type: string;
  noData: string;
  loadError: string;
  totalSent: string;
  todaySent: string;
  overviewTitle: string;
  recentTitle: string;
  searchPlaceholder: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    pageTitle: "Email Statistics",
    backHome: "Back to hub",
    backToAdmin: "← Back to Admin",
    accessDenied: "You do not have access to this page.",
    user: "User",
    date: "Date",
    time: "Time",
    type: "Type",
    noData: "No emails sent yet.",
    loadError: "Could not load email stats.",
    totalSent: "Total sent",
    todaySent: "Today",
    overviewTitle: "Overview",
    recentTitle: "Recent emails",
    searchPlaceholder: "Search by user hash…",
  },
  zh: {
    pageTitle: "邮件统计",
    backHome: "返回首页",
    backToAdmin: "← 返回管理",
    accessDenied: "你无权访问此页面。",
    user: "用户",
    date: "日期",
    time: "时间",
    type: "类型",
    noData: "暂无邮件发送记录。",
    loadError: "无法加载邮件统计。",
    totalSent: "累计发送",
    todaySent: "今日发送",
    overviewTitle: "概览",
    recentTitle: "近期邮件",
    searchPlaceholder: "按用户哈希搜索…",
  },
};

function reminderTypeLabel(type: string, lang: HubUiLang): string {
  switch (type) {
    case "24h":
    case "24h_before":
      return lang === "zh" ? "提前24小时" : "24h before";
    case "3h":
    case "3h_before":
      return lang === "zh" ? "提前3小时" : "3h before";
    case "overdue":
    case "overdue_once":
      return lang === "zh" ? "逾期提醒" : "Overdue";
    default:
      return type;
  }
}

export function AdminEmailPage() {
  const { language } = useHubUiLang();
  const t = translations[language];
  const {
    user,
    loading: authLoading,
    supabaseReady,
    isAdmin,
    profileLoading,
  } = useAuth();

  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!supabaseReady) return;
    setLoading(true);
    setLoadError("");
    const sb = getSupabase();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await sb
      .from("deadline_reminder_events")
      .select("user_id, task_id, reminder_type, sent_at")
      .eq("status", "sent")
      .gte("sent_at", thirtyDaysAgo)
      .order("sent_at", { ascending: false });
    if (error) {
      setLoadError(t.loadError);
      setEvents([]);
    } else {
      setEvents((data ?? []) as EmailEvent[]);
    }
    setLoading(false);
  }, [supabaseReady, t.loadError]);

  useEffect(() => {
    if (!authLoading && supabaseReady && user && isAdmin) {
      void load();
    }
    if (!supabaseReady || !user || !isAdmin) {
      setLoading(false);
    }
  }, [authLoading, supabaseReady, user, isAdmin, load]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const totalSent = events.length;
  const todaySent = events.filter((e) =>
    (e.sent_at as string).slice(0, 10) === todayStr,
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return events;
    return events.filter(
      (e) => hashUser(e.user_id).toUpperCase().includes(q),
    );
  }, [events, search]);

  // Per-user daily stats for overview
  const dailyStats = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const e of events) {
      const d = (e.sent_at as string).slice(0, 10);
      grouped[d] = (grouped[d] || 0) + 1;
    }
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [events]);

  if (!supabaseReady || authLoading || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 text-center">
        <p className="text-slate-600">{t.accessDenied}</p>
        <Link
          to="/auth/login"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          {t.backHome}
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 text-center">
        <p className="text-lg font-medium text-slate-800">{t.accessDenied}</p>
        <Link
          to="/"
          className="mt-6 inline-block text-blue-600 hover:underline"
        >
          {t.backHome}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            {t.backHome}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <HubAuthNav lang={language} compact />
            <HubLanguageToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {t.backToAdmin}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t.pageTitle}
        </h1>

        {/* Overview Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              {t.totalSent}
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {totalSent}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              {t.todaySent}
            </p>
            <p className="mt-1 text-3xl font-bold text-blue-600">
              {todaySent}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              {language === "zh" ? "7日趋势" : "7-day trend"}
            </p>
            <div className="mt-2 flex items-end gap-1">
              {dailyStats.slice().reverse().map((d) => {
                const max = Math.max(...dailyStats.map((x) => x.count), 1);
                const h = Math.max(8, (d.count / max) * 48);
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-slate-700">
                      {d.count}
                    </span>
                    <div
                      className="w-6 rounded bg-emerald-500"
                      style={{ height: `${h}px` }}
                    />
                    <span className="text-[10px] text-slate-400">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring-2"
          />
        </div>

        {loadError ? (
          <p className="mt-4 text-sm text-red-600">{loadError}</p>
        ) : null}

        {loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-400">{t.noData}</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.user}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.type}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.date}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.time}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((e) => (
                  <tr
                    key={`${e.sent_at}-${e.task_id}-${e.reminder_type}`}
                    className="border-b border-slate-100"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      #{hashUser(e.user_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {reminderTypeLabel(e.reminder_type, language)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {(e.sent_at as string).slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {(e.sent_at as string).slice(11, 19)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
