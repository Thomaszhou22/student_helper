import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { HubAuthNav } from "../components/HubAuthNav";
import { HubLanguageToggle } from "../components/HubLanguageToggle";
import { useHubUiLang, type HubUiLang } from "../context/HubUiLangContext";
import { getSupabase } from "../lib/supabase";
import { formatStorageMb, storageUsageRatio } from "../lib/storageQuota";

type AdminUserRow = {
  user_id: string;
  email: string;
  role: string;
  used_storage_bytes: number;
  max_storage_bytes: number;
};

type Translations = {
  pageTitle: string;
  backHome: string;
  backToAdmin: string;
  accessDenied: string;
  userEmail: string;
  role: string;
  storageUsed: string;
  storageLimit: string;
  usage: string;
  editLimit: string;
  save: string;
  cancel: string;
  searchPlaceholder: string;
  loadError: string;
  userLabel: string;
  adminLabel: string;
  customMb: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    pageTitle: "Storage Admin",
    backHome: "Back to hub",
    backToAdmin: "← Back to Admin",
    accessDenied: "You do not have access to this page.",
    userEmail: "Email",
    role: "Role",
    storageUsed: "Storage used",
    storageLimit: "Storage limit",
    usage: "Usage",
    editLimit: "Edit limit",
    save: "Save",
    cancel: "Cancel",
    searchPlaceholder: "Search by email…",
    loadError: "Could not load users.",
    userLabel: "User",
    adminLabel: "Admin",
    customMb: "Custom (MB)",
  },
  zh: {
    pageTitle: "存储管理",
    backHome: "返回首页",
    backToAdmin: "← 返回管理",
    accessDenied: "你无权访问此页面。",
    userEmail: "邮箱",
    role: "角色",
    storageUsed: "已使用存储",
    storageLimit: "存储上限",
    usage: "使用情况",
    editLimit: "修改上限",
    save: "保存",
    cancel: "取消",
    searchPlaceholder: "按邮箱搜索…",
    loadError: "无法加载用户列表。",
    userLabel: "用户",
    adminLabel: "管理员",
    customMb: "自定义（MB）",
  },
};

const PRESETS_MB = [50, 100, 200, 500] as const;

function roleLabel(role: string, t: Translations): string {
  if (role === "admin") return t.adminLabel;
  return t.userLabel;
}

export function AdminStoragePage() {
  const { language } = useHubUiLang();
  const t = translations[language];
  const {
    user,
    loading: authLoading,
    supabaseReady,
    isAdmin,
    profileLoading,
  } = useAuth();

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editMb, setEditMb] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseReady) return;
    setLoading(true);
    setLoadError("");
    const sb = getSupabase();
    const { data, error } = await sb.rpc("admin_list_users_with_storage");
    if (error) {
      setLoadError(t.loadError);
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as AdminUserRow[];
    setRows(list);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.email ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const openEdit = (r: AdminUserRow) => {
    setEditing(r);
    setEditMb(String(Math.round(r.max_storage_bytes / (1024 * 1024))));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const mb = Number.parseFloat(editMb.replace(",", "."));
    if (!Number.isFinite(mb) || mb < 1) return;
    const bytes = Math.round(mb * 1024 * 1024);
    setSaving(true);
    const sb = getSupabase();
    const { error } = await sb.rpc("admin_set_user_storage_quota", {
      p_user_id: editing.user_id,
      p_max_storage_bytes: bytes,
    });
    setSaving(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setEditing(null);
    void load();
  };

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
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.userEmail}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.role}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.storageUsed}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.storageLimit}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {t.usage}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    {" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ratio = storageUsageRatio(
                    r.used_storage_bytes,
                    r.max_storage_bytes,
                  );
                  const pct = Math.round(ratio * 100);
                  const rowBg =
                    ratio >= 1
                      ? "bg-red-50/80"
                      : ratio >= 0.8
                        ? "bg-amber-50/60"
                        : "";
                  return (
                    <tr key={r.user_id} className={`border-b border-slate-100 ${rowBg}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {roleLabel(r.role, t)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatStorageMb(r.used_storage_bytes)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatStorageMb(r.max_storage_bytes)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{pct}%</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t.editLimit}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">{t.editLimit}</h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {editing.email}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">
              {t.customMb}
            </p>
            <input
              type="number"
              min={1}
              step={1}
              value={editMb}
              onChange={(e) => setEditMb(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring-2"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS_MB.map((mb) => (
                <button
                  key={mb}
                  type="button"
                  onClick={() => setEditMb(String(mb))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {mb} MB
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {t.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
