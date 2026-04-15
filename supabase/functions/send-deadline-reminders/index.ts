/**
 * Scheduled job: send pending reminder emails (Resend).
 * Invoke with: Authorization: Bearer CRON_SECRET
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type TaskPayload = {
  title?: string;
  dueAt?: string;
  dueAtUtc?: string;
  status?: string;
  category?: string;
  priority?: string;
};

type ReminderType = "24h_before" | "3h_before" | "overdue_once";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dueMs(payload: TaskPayload): number | null {
  const raw = payload.dueAtUtc ?? payload.dueAt;
  if (!raw || typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function formatDue(
  payload: TaskPayload,
  lang: string,
): string {
  const raw = payload.dueAtUtc ?? payload.dueAt ?? "";
  const d = Date.parse(raw);
  if (!Number.isFinite(d)) return raw;
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

function subjectBody(
  type: ReminderType,
  title: string,
  dueStr: string,
  lang: string,
  category?: string,
  priority?: string,
): { subject: string; html: string } {
  const t = escapeHtml(title);
  const d = escapeHtml(dueStr);
  const cat = category ? escapeHtml(category) : "";
  const pr = priority ? escapeHtml(priority) : "";
  const extra =
    lang === "zh"
      ? `${cat ? `<p>分类：${cat}</p>` : ""}${pr ? `<p>优先级：${pr}</p>` : ""}`
      : `${cat ? `<p>Category: ${cat}</p>` : ""}${pr ? `<p>Priority: ${pr}</p>` : ""}`;

  if (lang === "zh") {
    if (type === "overdue_once") {
      return {
        subject: `任务已逾期：${title}`,
        html: `<p>你的任务「<strong>${t}</strong>」已超过截止时间。</p><p>截止时间：${d}</p>${extra}<p>请在 Deadline Tracker 中查看或更新。</p>`,
      };
    }
    if (type === "24h_before") {
      return {
        subject: `即将到期：${title}`,
        html: `<p>提醒：任务「<strong>${t}</strong>」将在约 24 小时内到期。</p><p>截止时间：${d}</p>${extra}`,
      };
    }
    return {
      subject: `任务提醒：${title}`,
      html: `<p>提醒：任务「<strong>${t}</strong>」将在约 3 小时内到期。</p><p>截止时间：${d}</p>${extra}`,
    };
  }

  if (type === "overdue_once") {
    return {
      subject: `Task overdue: ${title}`,
      html: `<p>Your task "<strong>${t}</strong>" is now overdue.</p><p>Due: ${d}</p>${extra}<p>Open Deadline Tracker to update or complete it.</p>`,
    };
  }
  if (type === "24h_before") {
    return {
      subject: `Upcoming deadline: ${title}`,
      html: `<p>Reminder: "<strong>${t}</strong>" is due in about 24 hours.</p><p>Due: ${d}</p>${extra}`,
    };
  }
  return {
    subject: `Deadline reminder: ${title}`,
    html: `<p>Reminder: "<strong>${t}</strong>" is due in about 3 hours.</p><p>Due: ${d}</p>${extra}`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!resendKey) {
    console.error("RESEND_API_KEY missing");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();

  const { data: events, error: eErr } = await supabase
    .from("deadline_reminder_events")
    .select("id, user_id, task_id, reminder_type, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(80);

  if (eErr) {
    console.error(eErr);
    return new Response(JSON.stringify({ error: eErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const ev of events ?? []) {
    const row = ev as {
      id: string;
      user_id: string;
      task_id: string;
      reminder_type: ReminderType;
    };

    const { data: taskRow } = await supabase
      .from("deadline_tasks")
      .select("payload")
      .eq("user_id", row.user_id)
      .eq("task_id", row.task_id)
      .maybeSingle();

    if (!taskRow) {
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "skipped",
          updated_at: nowIso,
          error_message: "task_deleted",
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const payload = (taskRow as { payload: TaskPayload }).payload;
    if (!payload || payload.status === "completed") {
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "skipped",
          updated_at: nowIso,
          error_message: "task_completed",
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const due = dueMs(payload);
    if (due == null) {
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "skipped",
          updated_at: nowIso,
          error_message: "invalid_due",
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const rtype = row.reminder_type;
    if (rtype === "24h_before" || rtype === "3h_before") {
      if (Date.now() > due) {
        await supabase
          .from("deadline_reminder_events")
          .update({
            status: "skipped",
            updated_at: nowIso,
            error_message: "past_due_window",
          })
          .eq("id", row.id);
        skipped++;
        continue;
      }
    }
    if (rtype === "overdue_once" && Date.now() < due) {
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "skipped",
          updated_at: nowIso,
          error_message: "not_overdue_yet",
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const { data: emailRpc, error: emailErr } = await supabase.rpc(
      "get_user_email_for_reminders",
      { p_user_id: row.user_id },
    );
    if (emailErr || !emailRpc || typeof emailRpc !== "string") {
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "failed",
          updated_at: nowIso,
          error_message: emailErr?.message ?? "no_email",
        })
        .eq("id", row.id);
      failed++;
      continue;
    }
    const toEmail = emailRpc as string;

    const { data: prefs } = await supabase
      .from("deadline_preferences")
      .select("language")
      .eq("user_id", row.user_id)
      .maybeSingle();
    const lang =
      (prefs as { language?: string } | null)?.language === "zh"
        ? "zh"
        : "en";

    const title = typeof payload.title === "string" ? payload.title : "Task";
    const dueStr = formatDue(payload, lang);
    const { subject, html } = subjectBody(
      rtype,
      title,
      dueStr,
      lang,
      payload.category,
      payload.priority,
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Deadline Tracker <${fromEmail}>`,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Resend error", errText);
      await supabase
        .from("deadline_reminder_events")
        .update({
          status: "failed",
          updated_at: nowIso,
          error_message: errText.slice(0, 500),
        })
        .eq("id", row.id);
      failed++;
      continue;
    }

    await supabase
      .from("deadline_reminder_events")
      .update({
        status: "sent",
        sent_at: nowIso,
        updated_at: nowIso,
        error_message: null,
      })
      .eq("id", row.id);
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
