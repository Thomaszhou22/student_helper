export type CloudSyncUiStatus =
  | "local_only"
  | "syncing"
  | "synced"
  | "error"
  | "unavailable";

const copy: Record<"en" | "zh", Record<CloudSyncUiStatus, string>> = {
  en: {
    local_only: "Log in to sync across devices",
    syncing: "Syncing…",
    synced: "Synced to your account",
    error: "Cloud sync unavailable",
    unavailable: "Cloud sync unavailable",
  },
  zh: {
    local_only: "登录后可跨设备同步",
    syncing: "同步中…",
    synced: "已同步到账号",
    error: "云同步暂时不可用",
    unavailable: "云同步暂时不可用",
  },
};

export function CloudSyncBadge({
  status,
  lang,
  detail,
  localOnlyLabel,
}: {
  status: CloudSyncUiStatus;
  lang: "en" | "zh";
  /** Optional one-line note (e.g. merge success) */
  detail?: string;
  /** When set and status is `local_only`, shown instead of the default line */
  localOnlyLabel?: string;
}) {
  const t =
    status === "local_only" && localOnlyLabel?.trim()
      ? localOnlyLabel.trim()
      : copy[lang][status];
  const color =
    status === "error" || status === "unavailable"
      ? "text-amber-700/90"
      : status === "syncing"
        ? "text-slate-500"
        : status === "synced"
          ? "text-emerald-700/90"
          : "text-slate-400";

  return (
    <div className="text-right">
      <p
        className={`max-w-[14rem] truncate text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs ${color}`}
        title={detail ? `${t} — ${detail}` : t}
      >
        {t}
      </p>
      {detail ? (
        <p
          className="mt-0.5 max-w-[16rem] text-[10px] leading-snug text-slate-500 sm:text-[11px]"
          title={detail}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}
