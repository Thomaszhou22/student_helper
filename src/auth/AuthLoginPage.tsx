import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { useAuth } from "./AuthContext";
import {
  authErrorCopy,
  authFormCopy,
  mapAuthErrorMessage,
  MIN_PASSWORD_LENGTH,
} from "./authCopy";
import { HubAuthNav } from "../components/HubAuthNav";
import { HubLanguageToggle } from "../components/HubLanguageToggle";
import { useHubUiLang } from "../context/HubUiLangContext";

function isValidEmail(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 3) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function AuthLoginPage() {
  const { language } = useHubUiLang();
  const t = authFormCopy[language];
  const errT = authErrorCopy[language];
  const { signIn, loading: authLoading, user, supabaseReady } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!supabaseReady) {
      setFormError(t.authConfigMissing);
      return;
    }

    const em = email.trim();
    if (!isValidEmail(em)) {
      setFormError(errT.invalidEmail);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(errT.weakPassword);
      return;
    }

    setSubmitting(true);
    const { error } = await signIn(em, password);
    setSubmitting(false);

    if (error) {
      setFormError(mapAuthErrorMessage(error, language));
      return;
    }
    navigate("/", { replace: true });
  }

  const disabled = submitting || authLoading || !supabaseReady;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-slate-900"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-soft">
              <GraduationCap className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="truncate">Student Tools Hub</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <HubAuthNav lang={language} compact />
            <HubLanguageToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t.loginTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{t.loginSubtitle}</p>

          {import.meta.env.DEV ? (
            <p
              className="mt-2 text-xs font-mono text-slate-500"
              data-debug="supabase-ready"
            >
              {supabaseReady ? "Supabase ready" : "Supabase NOT ready"}
            </p>
          ) : null}

          {!supabaseReady ? (
            <div
              className="mt-6 rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {t.authConfigMissing}
            </div>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
            <div>
              <label
                htmlFor="auth-login-email"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {t.email}
              </label>
              <input
                id="auth-login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={disabled}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label
                htmlFor="auth-login-password"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {t.password}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="auth-login-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-11 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2 disabled:bg-slate-50"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t.hidePassword : t.showPassword}
                  tabIndex={-1}
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {formError ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={disabled}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "…" : t.submitLogin}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              to="/auth/signup"
              className="font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {t.switchToSignup}
            </Link>
          </p>
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            {t.alreadyVerifiedHint}
          </p>
        </div>
      </main>
    </div>
  );
}
