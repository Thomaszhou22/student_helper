import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

interface DeadlineTask {
  task_id: string;
  payload: {
    title?: string;
    dueAt?: string;
    dueAtUtc?: string;
    priority?: string;
    category?: string;
  };
  user_id: string;
}

interface ReminderSettings {
  user_id: string;
  enabled: boolean;
  remind_24h: boolean;
  remind_3h: boolean;
  remind_overdue: boolean;
}

interface ReminderEvent {
  id: string;
  user_id: string;
  task_id: string;
  reminder_type: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  error_message: string | null;
}

type ReminderType = "24h" | "3h" | "overdue";

Deno.serve(async () => {
  try {
    const now = new Date();
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Get all users with reminders enabled
    const { data: settings, error: settingsError } = await supabase
      .from("deadline_reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (settingsError) throw new Error(`Settings fetch error: ${settingsError.message}`);
    if (!settings || settings.length === 0) {
      console.log("No users with reminders enabled");
      return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Get user emails from auth
    const userIds = settings.map((s: ReminderSettings) => s.user_id);

    // 3. Get all deadline tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("deadline_tasks")
      .select("task_id, payload, user_id");

    if (tasksError) throw new Error(`Tasks fetch error: ${tasksError.message}`);
    if (!tasks || tasks.length === 0) {
      console.log("No deadline tasks found");
      return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    // 4. Check each task and send reminders
    let sentCount = 0;

    for (const setting of settings) {
      const userTasks = (tasks as DeadlineTask[]).filter((t) => t.user_id === setting.user_id);
      if (userTasks.length === 0) continue;

      // Get user email from auth.users
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
        filters: {
          id: setting.user_id,
        },
      });

      if (authError || !users || users.length === 0) {
        console.log(`Could not find user ${setting.user_id}`);
        continue;
      }

      const userEmail = users[0].email;
      if (!userEmail) continue;

      for (const task of userTasks) {
        const dueAtStr = task.payload.dueAtUtc || task.payload.dueAt;
        if (!dueAtStr) continue;

        const dueAt = new Date(dueAtStr);
        if (isNaN(dueAt.getTime())) continue;

        const title = task.payload.title || "Untitled task";

        // Check what reminders to send
        const remindersToSend: ReminderType[] = [];

        // Homework: no reminders
        // Exam, Application, Personal: 24h reminder only
        const category = task.payload.category?.toLowerCase();
        if (category === "homework") {
          continue; // skip homework, no notifications
        }

        // 24h check: task is due within the next 24 hours
        if (dueAt > now && dueAt <= in24h) {
          remindersToSend.push("24h");
        }

        for (const reminderType of remindersToSend) {
          // Check if already sent
          const { data: existingEvents } = await supabase
            .from("deadline_reminder_events")
            .select("id, status")
            .eq("user_id", setting.user_id)
            .eq("task_id", task.task_id)
            .eq("reminder_type", reminderType)
            .eq("status", "sent")
            .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (existingEvents && existingEvents.length > 0) continue;

          // Create reminder event
          const { data: event, error: eventError } = await supabase
            .from("deadline_reminder_events")
            .insert({
              user_id: setting.user_id,
              task_id: task.task_id,
              reminder_type: reminderType,
              scheduled_for: now.toISOString(),
              status: "pending",
            })
            .select()
            .single();

          if (eventError || !event) {
            console.error(`Failed to create reminder event: ${eventError?.message}`);
            continue;
          }

          // Send email via Resend
          const subject = getSubject(reminderType, title);
          const htmlBody = getHtmlBody(reminderType, title, dueAt, userEmail);

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `Student Tools Hub <${FROM_EMAIL}>`,
                to: userEmail,
                subject,
                html: htmlBody,
              }),
            });

            if (res.ok) {
              // Update event as sent
              await supabase
                .from("deadline_reminder_events")
                .update({ status: "sent", sent_at: now.toISOString() })
                .eq("id", event.id);
              sentCount++;
              console.log(`Sent ${reminderType} reminder for "${title}" to ${userEmail}`);
            } else {
              const errBody = await res.text();
              await supabase
                .from("deadline_reminder_events")
                .update({ status: "failed", error_message: errBody })
                .eq("id", event.id);
              console.error(`Resend error: ${res.status} ${errBody}`);
            }
          } catch (emailError) {
            await supabase
              .from("deadline_reminder_events")
              .update({ status: "failed", error_message: String(emailError) })
              .eq("id", event.id);
            console.error(`Email send error: ${emailError}`);
          }
        }
      }
    }

    console.log(`Done. Sent ${sentCount} reminders.`);
    return new Response(
      JSON.stringify({ sent: sentCount }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

function getSubject(type: ReminderType, title: string): string {
  switch (type) {
    case "3h":
      return `⏰ Reminder: "${title}" is due in 3 hours`;
    case "24h":
      return `📅 Reminder: "${title}" is due tomorrow`;
    case "overdue":
      return `⚠️ Overdue: "${title}" is past due`;
  }
}

function getHtmlBody(type: ReminderType, title: string, dueAt: Date, email: string): string {
  const dueAtStr = dueAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  let message = "";
  let color = "#3b82f6";

  switch (type) {
    case "3h":
      message = "is due in 3 hours!";
      color = "#ef4444";
      break;
    case "24h":
      message = "is due tomorrow.";
      color = "#f59e0b";
      break;
    case "overdue":
      message = "is past due!";
      color = "#ef4444";
      break;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr style="background:${color};">
      <td style="padding:24px 32px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">
          ${type === "overdue" ? "⚠️" : "📋"} Deadline Reminder
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:18px;color:#1e293b;">
          <strong>"${escapeHtml(title)}"</strong> ${message}
        </p>
        <p style="margin:0 0 8px;color:#64748b;font-size:14px;">
          📅 Due: ${dueAtStr}
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">
          This reminder was sent to ${escapeHtml(email)}.<br>
          You can manage your reminder settings in Student Tools Hub.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
