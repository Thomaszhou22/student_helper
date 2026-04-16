import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("MY_SUPABASE_URL")!;
const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

const supabase = createClient(supabaseUrl, serviceKey);

type ReminderType = "24h" | "3h" | "overdue";

Deno.serve(async () => {
  try {
    const now = new Date();
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: settings, error: sErr } = await supabase
      .from("deadline_reminder_settings").select("*").eq("enabled", true);
    if (sErr) throw new Error(`Settings: ${sErr.message}`);
    if (!settings?.length) return ok(0);

    const { data: tasks, error: tErr } = await supabase
      .from("deadline_tasks").select("task_id, payload, user_id");
    if (tErr) throw new Error(`Tasks: ${tErr.message}`);
    if (!tasks?.length) return ok(0);

    let sent = 0;

    for (const s of settings) {
      const uid = s.user_id;
      const ut = (tasks as any[]).filter(t => t.user_id === uid);
      if (!ut.length) continue;

      const aRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      if (!aRes.ok) continue;
      const aData = await aRes.json();
      const email = aData.email;
      if (!email) continue;

      for (const t of ut) {
        const p = t.payload;
        const dueStr = p.dueAtUtc || p.dueAt;
        if (!dueStr) continue;
        const due = new Date(dueStr);
        if (isNaN(due.getTime())) continue;
        if (p.status === "completed" || p.category?.toLowerCase() === "homework") continue;

        const types: ReminderType[] = [];
        if (due > now && due <= in24h && s.remind_24h) types.push("24h");
        if (due > now && due <= in3h && s.remind_3h) types.push("3h");
        if (due <= now && s.remind_overdue) types.push("overdue");

        for (const rtype of types) {
          const { data: ex } = await supabase.from("deadline_reminder_events")
            .select("id").eq("user_id", uid).eq("task_id", t.task_id)
            .eq("reminder_type", rtype).eq("status", "sent")
            .gte("created_at", new Date(now.getTime() - 86400000).toISOString()).limit(1);
          if (ex?.length) continue;

          if (rtype === "overdue") {
            const { data: odEx } = await supabase.from("deadline_reminder_events")
              .select("id").eq("user_id", uid).eq("task_id", t.task_id)
              .eq("reminder_type", "overdue").eq("status", "sent")
              .gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()).limit(1);
            if (odEx?.length) continue;
          }

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `Student Tools Hub <${FROM_EMAIL}>`, to: email,
              subject: getSubject(rtype, p.title),
              html: getHtmlBody(rtype, p.title, due, email),
            }),
          });

          await supabase.from("deadline_reminder_events").insert({
            user_id: uid, task_id: t.task_id, reminder_type: rtype,
            scheduled_for: now.toISOString(), status: res.ok ? "sent" : "failed",
            sent_at: res.ok ? now.toISOString() : null,
          });
          if (res.ok) sent++;
        }
      }
    }
    return ok(sent);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: ct });
  }
});

function ok(sent: number) {
  return new Response(JSON.stringify({ sent }), { headers: ct });
}

const ct = { "Content-Type": "application/json" };

function getSubject(type: ReminderType, title: string): string {
  switch (type) {
    case "3h": return `⏰ Reminder: "${title}" is due in 3 hours`;
    case "24h": return `📅 Reminder: "${title}" is due tomorrow`;
    case "overdue": return `⚠️ Overdue: "${title}" is past due`;
  }
}

function getHtmlBody(type: ReminderType, title: string, dueAt: Date, email: string): string {
  const dueAtStr = dueAt.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
  let message = "", color = "#3b82f6";
  switch (type) {
    case "3h": message = "is due in 3 hours!"; color = "#ef4444"; break;
    case "24h": message = "is due tomorrow."; color = "#f59e0b"; break;
    case "overdue": message = "is past due!"; color = "#ef4444"; break;
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<tr style="background:${color};"><td style="padding:24px 32px;color:#fff;">
<h1 style="margin:0;font-size:20px;">${type === "overdue" ? "⚠️" : "📋"} Deadline Reminder</h1>
</td></tr><tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:18px;color:#1e293b;"><strong>"${esc(title)}"</strong> ${message}</p>
<p style="margin:0 0 8px;color:#64748b;font-size:14px;">📅 Due: ${dueAtStr}</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
<p style="margin:0;color:#94a3b8;font-size:12px;">Sent to ${esc(email)}. Manage reminders in Student Tools Hub.</p>
</td></tr></table></body></html>`;
}
