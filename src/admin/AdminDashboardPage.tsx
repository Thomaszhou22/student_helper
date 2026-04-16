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

type Translations = {
  pageTitle: string;
  backHome: string;
  accessDenied: string;
  cardStorageTitle: string;
  cardStorageDesc: string;
  emailStatsTitle: string;
  emailStatsDesc: string;
  totalSentShort: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    pageTitle: "Admin",
    backHome: "Back to hub",
    accessDenied: "You do not have access to this page.",
    cardStorageTitle: "Storage Management",
    cardStorageDesc: "View and manage user storage usage and limits",
    emailStatsTitle: "Email Statistics",
    emailStatsDesc: "View reminder email delivery logs and per-user stats",
    totalSentShort: "sent",
  },
  zh: {
    pageTitle: "管理",
    backHome: "返回首页",
    accessDenied: "你无权访问此页面。",
    cardStorageTitle: "存储管理",
    cardStorageDesc: "查看和调整用户的存储使用和上限",
    emailStatsTitle: "邮件统计",
    emailStatsDesc: "查看提醒邮件的发送记录和用户统计",
    totalSentShort: "已发送",
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

  const [totalSent, setTotalSent] = useState<number | null>(null);

  useEffect(() => {
    if (!supabaseReady || !user || !isAdmin) return;
    const sb = getSupabase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    sb.from("deadline_reminder_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", thirtyDaysAgo)
      .then(({ count }) => setTotalSent(count ?? 0));
  }, [supabaseReady, user, isAdmin]);

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
          <Link
            to="/admin/email"
            className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 transition duration-300 hover:-translate-y-1 hover:border-emerald-200/80 hover:shadow-lift"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20">
              <Mail className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-emerald-700">
              {t.emailStatsTitle}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              {t.emailStatsDesc}
            </p>
            {totalSent !== null ? (
              <p className="mt-4 text-sm font-medium text-slate-400">
                {totalSent} {t.totalSentShort} · 30d
              </p>
            ) : null}
          </Link>
        </div>
      </main>
    </div>
  );
}
