import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchDeadlineReminderSettings,
  upsertDeadlineReminderSettings,
  type DeadlineReminderSettingsRow,
} from "../sync/deadlineReminderSettingsSync";
type DeadlineLang = "en" | "zh";

type Props = {
  language: DeadlineLang;
};

const copy = {
  en: {
    cardTitle: "Email reminders",
    enable: "Enable email reminders",
    h24: "24 hours before",
    h3: "3 hours before",
    overdue: "When overdue",
    dailySummary: "Daily summary",
    loginHint: "Log in to use email reminders",
    statusOn: "Email reminders are enabled",
    statusOff: "Email reminders are off",
    saving: "Saving…",
  },
  zh: {
    cardTitle: "邮件提醒",
    enable: "开启邮件提醒",
    h24: "提前 24 小时",
    h3: "提前 3 小时",
    overdue: "任务逾期时",
    dailySummary: "每日汇总",
    loginHint: "登录后可使用邮件提醒",
    statusOn: "邮件提醒已开启",
    statusOff: "邮件提醒已关闭",
    saving: "保存中…",
  },
} as const;

export function DeadlineReminderSettings({ language }: Props) {
  const t = copy[language];
  const { user, loading: authLoading, supabaseReady } = useAuth();
  const [row, setRow] = useState<DeadlineReminderSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !supabaseReady) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { settings, error } = await fetchDeadlineReminderSettings(user);
    if (error) {
      setRow({
        user_id: user.id,
        enabled: false,
        remind_24h: true,
        remind_3h: true,
        remind_overdue: true,
        daily_summary_enabled: false,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    } else if (settings) {
      setRow(settings);
    } else {
      setRow({
        user_id: user.id,
        enabled: false,
        remind_24h: true,
        remind_3h: true,
        remind_overdue: true,
        daily_summary_enabled: false,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [user, supabaseReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (
      p: Partial<
        Pick<
          DeadlineReminderSettingsRow,
          | "enabled"
          | "remind_24h"
          | "remind_3h"
          | "remind_overdue"
          | "daily_summary_enabled"
        >
      >,
    ) => {
      if (!user || !supabaseReady) return;
      setSaving(true);
      const { error } = await upsertDeadlineReminderSettings(user, p);
      setSaving(false);
      if (!error) void load();
    },
    [user, supabaseReady, load],
  );

  if (!supabaseReady || authLoading) {
    return null;
  }

  if (!user) {
    return (
      <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t.cardTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.loginHint}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !row) {
    return (
      <div className="mb-8 flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        …
      </div>
    );
  }

  const disabled = saving || !row.enabled;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{t.cardTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {row.enabled ? t.statusOn : t.statusOff}
            {saving ? ` · ${t.saving}` : null}
          </p>

          <label className="mt-4 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={row.enabled}
              onChange={(e) => void patch({ enabled: e.target.checked })}
            />
            <span className="text-sm font-medium text-slate-800">{t.enable}</span>
          </label>

          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={row.remind_24h}
                onChange={(e) => void patch({ remind_24h: e.target.checked })}
              />
              <span className="text-sm text-slate-700">{t.h24}</span>
            </label>
            <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={row.remind_3h}
                onChange={(e) => void patch({ remind_3h: e.target.checked })}
              />
              <span className="text-sm text-slate-700">{t.h3}</span>
            </label>
            <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={row.remind_overdue}
                onChange={(e) => void patch({ remind_overdue: e.target.checked })}
              />
              <span className="text-sm text-slate-700">{t.overdue}</span>
            </label>
            <label className="flex cursor-not-allowed items-center gap-2 opacity-50">
              <input
                type="checkbox"
                disabled
                className="h-4 w-4 rounded border-slate-300"
                checked={false}
              />
              <span className="text-sm text-slate-500">
                {t.dailySummary}{" "}
                <span className="text-[11px] text-slate-400">
                  {language === "zh" ? "（可选）" : "(soon)"}
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
