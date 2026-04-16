import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  HardDrive,
  Loader2,
  Mail,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { HubAuthNav } from "../components/HubAuthNav";
import { HubLanguageToggle } from "../components/HubLanguageToggle";
import { useHubUiLang, type HubUiLang } from "../context/HubUiLangContext";
import { getSupabase } from "../lib/supabase";

type DayStats = {
  date: string;
  userHash: string;
  count: number;
};

/** Short, opaque user identifier for admin display (privacy-safe) */
function hashUser(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().slice(0, 6);
}

type Translations = {
  pageTitle: string;
  backHome: string;
  accessDenied: string;
  cardStorageTitle: string;
  cardStorageDesc: string;
  emailStatsTitle: string;
  emailStatsDesc: string;
  date: string;
  user: string;
  sentCount: string;
  totalSent: string;
  noData: string;
  loadError: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    pageTitle: "Admin",
    backHome: "Back to hub",
    accessDenied: "You do not have access to this page.",
    cardStorageTitle: "Storage Management",
    cardStorageDesc: "View and manage user storage usage and limits",
    emailStatsTitle: "Email Statistics",
    emailStatsDesc: "Daily reminder email send count",
    date: "Date",
    user: "User",
    sentCount: "Sent",
    totalSent: "Total sent",
    noData: "No emails sent yet.",
    loadError: "Could not load email stats.",
  },
  zh: {
    pageTitle: "管理",
    backHome: "返回首页",
    accessDenied: "你无权访问此页面。",
    cardStorageTitle: "存储管理",
    cardStorageDesc: "查看和调整用户的存储使用和上限",
    emailStatsTitle: "邮件统计",
    emailStatsDesc: "每日提醒邮件发送数量",
    date: "日期",
    user: "用户",
    sentCount: "发送数量",
    totalSent: "累计发送",
    noData: "暂无邮件发送记录。",
    loadError: "无法加载邮件统计。",
  },
};

export function AdminDashboardPage() {
  const { language } = useHubUiLang();
  const t = translations[language];
  const {
    user,
    loading: authLoading,
    supabaseReady,
    isAdmin,
    profileLoading,
  } = useAuth();

  const [emailStats, setEmailStats] = useState<DayStats[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!supabaseReady || !user || !isAdmin) return;
    const sb = getSupabase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    sb.from("deadline_reminder_events")
      .select("user_id, sent_at")
      .eq("status", "sent")
      .gte("sent_at", thirtyDaysAgo)
      .order("sent_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setEmailError(t.loadError);
        } else {
          // Group by date + user (privacy-safe: user_id hashed)
          const grouped: Record<string, number> = {};
          for (const row of data ?? []) {
            const d = (row.sent_at as string).slice(0, 10);
            const key = `${d}|${hashUser(row.user_id as string)}`;
            grouped[key] = (grouped[key] || 0) + 1;
          }
          setEmailStats(
            Object.entries(grouped)
              .map(([key, count]) => {
                const [date, userHash] = key.split("|");
                return { date, userHash, count };
              })
              .sort((a, b) => b.date.localeCompare(a.date) || a.userHash.localeCompare(b.userHash)),
          );
        }
        setEmailLoading(false);
      });
  }, [supabaseReady, user, isAdmin, t.loadError]);

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

  const totalSent = emailStats.reduce((s, d) => s + d.count, 0);

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t.pageTitle}
        </h1>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Storage Card */}
          <Link
            to="/admin/storage"
            className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 transition duration-300 hover:-translate-y-1 hover:border-blue-200/80 hover:shadow-lift"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <HardDrive className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-blue-700">
              {t.cardStorageTitle}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              {t.cardStorageDesc}
            </p>
          </Link>

          {/* Email Stats Card */}
          <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20">
              <Mail className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              {t.emailStatsTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t.emailStatsDesc}
            </p>

            {emailLoading ? (
              <div className="mt-4 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : emailError ? (
              <p className="mt-4 text-sm text-red-500">{emailError}</p>
            ) : emailStats.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">{t.noData}</p>
            ) : (
              <>
                <p className="mt-4 text-2xl font-bold text-emerald-600">
                  {totalSent}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    {t.totalSent}
                  </span>
                </p>
                <div className="mt-4 flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                        <th className="pb-2">{t.date}</th>
                        <th className="pb-2">{t.user}</th>
                        <th className="pb-2 text-right">{t.sentCount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailStats.slice(0, 10).map((d) => (
                        <tr key={`${d.date}-${d.userHash}`} className="border-b border-slate-50">
                          <td className="py-1.5 text-slate-700">{d.date}</td>
                          <td className="py-1.5 font-mono text-xs text-slate-500">#{d.userHash}</td>
                          <td className="py-1.5 text-right font-medium text-slate-900">
                            {d.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
