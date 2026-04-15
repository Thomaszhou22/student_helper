import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  HardDrive,
  Loader2,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { HubAuthNav } from "../components/HubAuthNav";
import { HubLanguageToggle } from "../components/HubLanguageToggle";
import { useHubUiLang, type HubUiLang } from "../context/HubUiLangContext";

type Translations = {
  pageTitle: string;
  subtitle: string;
  backHome: string;
  accessDenied: string;
  cardStorageTitle: string;
  cardStorageDesc: string;
  cardUsersTitle: string;
  cardUsersDesc: string;
  cardAnalyticsTitle: string;
  cardAnalyticsDesc: string;
  comingSoon: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    pageTitle: "Admin",
    subtitle: "Choose an admin module.",
    backHome: "Back to hub",
    accessDenied: "You do not have access to this page.",
    cardStorageTitle: "Storage Management",
    cardStorageDesc: "View and manage user storage usage and limits",
    cardUsersTitle: "User Management",
    cardUsersDesc: "View and manage users",
    cardAnalyticsTitle: "Analytics",
    cardAnalyticsDesc: "Usage insights and stats",
    comingSoon: "Coming soon",
  },
  zh: {
    pageTitle: "管理",
    subtitle: "选择要使用的管理功能。",
    backHome: "返回首页",
    accessDenied: "你无权访问此页面。",
    cardStorageTitle: "存储管理",
    cardStorageDesc: "查看和调整用户的存储使用和上限",
    cardUsersTitle: "用户管理",
    cardUsersDesc: "查看和管理用户",
    cardAnalyticsTitle: "数据分析",
    cardAnalyticsDesc: "使用情况与统计",
    comingSoon: "即将推出",
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
        <p className="mt-2 text-sm text-slate-500">{t.subtitle}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <div
            className="flex h-full cursor-not-allowed flex-col rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 opacity-60 ring-1 ring-slate-100"
            aria-disabled="true"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                <Users className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <span className="shrink-0 rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {t.comingSoon}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-700">
              {t.cardUsersTitle}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
              {t.cardUsersDesc}
            </p>
          </div>

          <div
            className="flex h-full cursor-not-allowed flex-col rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 opacity-60 ring-1 ring-slate-100 sm:col-span-2 lg:col-span-1"
            aria-disabled="true"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                <BarChart3 className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <span className="shrink-0 rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {t.comingSoon}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-700">
              {t.cardAnalyticsTitle}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
              {t.cardAnalyticsDesc}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
