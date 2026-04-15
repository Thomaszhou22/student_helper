import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { authNavCopy } from "../auth/authCopy";
import type { HubUiLang } from "../context/HubUiLangContext";

type HubAuthNavProps = {
  lang: HubUiLang;
  /** Smaller text on dense tool headers */
  compact?: boolean;
};

export function HubAuthNav({ lang, compact }: HubAuthNavProps) {
  const { user, loading, signOut, supabaseReady, isAdmin } = useAuth();
  const t = authNavCopy[lang];

  const textCls = compact
    ? "text-xs font-semibold sm:text-sm"
    : "text-sm font-semibold";

  if (loading && supabaseReady) {
    return (
      <span
        className={`${textCls} text-slate-400`}
        aria-live="polite"
        aria-busy="true"
      >
        …
      </span>
    );
  }

  if (user) {
    const email = user.email ?? "";
    return (
      <div className="flex max-w-full min-w-0 items-center gap-2 sm:gap-3">
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/admin"
              className={`rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/80 ${compact ? "text-xs" : "text-sm"}`}
            >
              {t.adminNav}
            </Link>
            {t.adminNav !== t.adminBadge ? (
              <span
                className={`hidden rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-slate-500 sm:inline ${compact ? "text-[10px]" : "text-[11px]"}`}
                title={t.adminBadge}
              >
                {t.adminBadge}
              </span>
            ) : null}
          </div>
        ) : null}
        <span
          className={`hidden min-w-0 max-w-[10rem] truncate text-slate-600 sm:inline ${compact ? "text-xs" : "text-sm"}`}
          title={email}
        >
          {email}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-50 ${textCls}`}
        >
          {t.logOut}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <Link
        to="/auth/login"
        className={`rounded-lg px-2.5 py-1.5 text-slate-600 transition hover:text-blue-600 ${textCls}`}
      >
        {t.logIn}
      </Link>
      <Link
        to="/auth/signup"
        className={`rounded-lg bg-blue-600 px-2.5 py-1.5 text-white shadow-sm transition hover:bg-blue-700 ${textCls}`}
      >
        {t.signUp}
      </Link>
    </div>
  );
}
