import type { HubUiLang } from "../context/HubUiLangContext";

export const MIN_PASSWORD_LENGTH = 8;

export type AuthNavCopy = {
  logIn: string;
  signUp: string;
  logOut: string;
  account: string;
  /** Nav link to `/admin` — admins only */
  adminNav: string;
  /** Subtle badge next to admin nav */
  adminBadge: string;
};

export const authNavCopy: Record<HubUiLang, AuthNavCopy> = {
  en: {
    logIn: "Log in",
    signUp: "Sign up",
    logOut: "Log out",
    account: "Account",
    adminNav: "Admin",
    adminBadge: "Admin",
  },
  zh: {
    logIn: "登录",
    signUp: "注册",
    logOut: "退出登录",
    account: "账号",
    adminNav: "管理",
    adminBadge: "管理员",
  },
};

export type AuthFormCopy = {
  loginTitle: string;
  loginSubtitle: string;
  signupTitle: string;
  signupSubtitle: string;
  email: string;
  password: string;
  confirmPassword: string;
  submitLogin: string;
  submitSignup: string;
  switchToSignup: string;
  switchToLogin: string;
  showPassword: string;
  hidePassword: string;
  passwordHint: string;
  /** Shown after signup when email confirmation is required (success state). */
  signupCheckEmailTitle: string;
  signupCheckEmailBody: string;
  signupCheckEmailSecondary: string;
  goToLogin: string;
  backHome: string;
  /** Subtle hint on login for users who just verified email */
  alreadyVerifiedHint: string;
  /** When Supabase env is missing — separate from email verification */
  authConfigMissing: string;
};

export const authFormCopy: Record<HubUiLang, AuthFormCopy> = {
  en: {
    loginTitle: "Log in",
    loginSubtitle: "Welcome back to Student Tools Hub",
    signupTitle: "Create account",
    signupSubtitle: "Start using Student Tools Hub across devices",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    submitLogin: "Log in",
    submitSignup: "Create account",
    switchToSignup: "Don’t have an account? Sign up",
    switchToLogin: "Already have an account? Log in",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordHint: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    signupCheckEmailTitle: "Check your email",
    signupCheckEmailBody:
      "We sent a verification link to your email address. Please open your inbox and confirm your account before logging in.",
    signupCheckEmailSecondary:
      "After verifying your email, return here and log in.",
    goToLogin: "Go to Log in",
    backHome: "Back to Home",
    alreadyVerifiedHint: "Already verified your email? Log in here.",
    authConfigMissing:
      "No Supabase keys loaded. Create a `.env` file in the project folder (copy `.env.example`), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project (Settings → API), then restart `npm run dev`.",
  },
  zh: {
    loginTitle: "登录",
    loginSubtitle: "欢迎回到 Student Tools Hub",
    signupTitle: "注册账号",
    signupSubtitle: "开始跨设备使用 Student Tools Hub",
    email: "邮箱",
    password: "密码",
    confirmPassword: "确认密码",
    submitLogin: "登录",
    submitSignup: "注册账号",
    switchToSignup: "还没有账号？去注册",
    switchToLogin: "已有账号？去登录",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    passwordHint: `密码至少 ${MIN_PASSWORD_LENGTH} 位。`,
    signupCheckEmailTitle: "请检查你的邮箱",
    signupCheckEmailBody:
      "我们已向你的邮箱发送验证链接。请先前往邮箱完成账号验证，再回来登录。",
    signupCheckEmailSecondary: "完成邮箱验证后，请返回这里登录。",
    goToLogin: "前往登录",
    backHome: "返回首页",
    alreadyVerifiedHint: "已经完成邮箱验证？请在这里登录。",
    authConfigMissing:
      "未加载 Supabase 配置：请在项目根目录创建 `.env`（可复制 `.env.example`），填入 Supabase 控制台「设置 → API」中的项目 URL 与 anon 公钥，保存后重新运行 `npm run dev`。",
  },
};

export type AuthErrorCopy = {
  generic: string;
  network: string;
  invalidEmail: string;
  weakPassword: string;
  passwordMismatch: string;
  emailInUse: string;
  invalidCredentials: string;
  emailNotConfirmed: string;
  tooManyRequests: string;
  /** When backend indicates signup exists but login blocked until verify */
  emailVerificationRequired: string;
};

export const authErrorCopy: Record<HubUiLang, AuthErrorCopy> = {
  en: {
    generic: "Something went wrong. Please try again.",
    network: "Network error. Check your connection and try again.",
    invalidEmail: "Please enter a valid email address.",
    weakPassword: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    passwordMismatch: "Passwords do not match.",
    emailInUse: "That email is already registered.",
    invalidCredentials: "Invalid email or password.",
    emailNotConfirmed: "Please confirm your email before signing in.",
    tooManyRequests: "Too many attempts. Please wait a moment and try again.",
    emailVerificationRequired:
      "Please verify your email first. Check your inbox for the link we sent.",
  },
  zh: {
    generic: "出错了，请稍后再试。",
    network: "网络异常，请检查连接后重试。",
    invalidEmail: "请输入有效的邮箱地址。",
    weakPassword: `密码至少需要 ${MIN_PASSWORD_LENGTH} 位。`,
    passwordMismatch: "两次输入的密码不一致。",
    emailInUse: "该邮箱已被注册。",
    invalidCredentials: "邮箱或密码不正确。",
    emailNotConfirmed: "请先完成邮箱验证再登录。",
    tooManyRequests: "尝试次数过多，请稍后再试。",
    emailVerificationRequired:
      "请先完成邮箱验证。请查收我们发送的邮件中的链接。",
  },
};

/** Map Supabase / browser errors to friendly copy (bilingual). */
export function mapAuthErrorMessage(
  err: unknown,
  lang: HubUiLang,
): string {
  const t = authErrorCopy[lang];
  if (err == null) return t.generic;

  const msg =
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : String(err);

  const lower = msg.toLowerCase();

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch")
  ) {
    return t.network;
  }
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials")
  ) {
    return t.invalidCredentials;
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already registered")
  ) {
    return t.emailInUse;
  }
  if (
    lower.includes("email not confirmed") ||
    lower.includes("email address not confirmed")
  ) {
    return t.emailNotConfirmed;
  }
  if (lower.includes("password") && lower.includes("least")) {
    return t.weakPassword;
  }
  if (lower.includes("invalid email")) {
    return t.invalidEmail;
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return t.tooManyRequests;
  }
  if (lower.includes("user not found")) {
    return t.invalidCredentials;
  }
  if (
    lower.includes("verify your email") ||
    lower.includes("confirm your email") ||
    lower.includes("email confirmation") ||
    lower.includes("signup_disabled") ||
    lower.includes("signups not allowed")
  ) {
    return t.emailVerificationRequired;
  }
  if (
    lower.includes("token") &&
    (lower.includes("expired") || lower.includes("invalid"))
  ) {
    return t.emailVerificationRequired;
  }

  return t.generic;
}
