/**
 * Scheduled job: create/update pending deadline_reminder_events from cloud tasks.
 * Invoke with: Authorization: Bearer CRON_SECRET
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MS_H = 3_600_000;

type ReminderType = "24h_before" | "3h_before" | "overdue_once";

type TaskPayload = {
  id?: string;
  title?: string;
  dueAt?: string;
  dueAtUtc?: string;
  status?: string;
};

function dueMs(payload: TaskPayload): number | null {
  const raw = payload.dueAtUtc ?? payload.dueAt;
  if (!raw || typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function scheduledFor(
  type: ReminderType,
  due: number,
): number {
  switch (type) {
    case "24h_before":
      return due - 24 * MS_H;
    case "3h_before":
      return due - 3 * MS_H;
    case "overdue_once":
      return due;
    default:
      return due;
  }
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
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: settingsRows, error: sErr } = await supabase
    .from("deadline_reminder_settings")
    .select("user_id, enabled, remind_24h, remind_3h, remind_overdue, daily_summary_enabled")
    .eq("enabled", true);

  if (sErr) {
    console.error("settings fetch", sErr);
    return new Response(JSON.stringify({ error: sErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let upserts = 0;
  const users = settingsRows ?? [];

  for (const row of users) {
    const userId = (row as { user_id: string }).user_id;
    const remind24 = (row as { remind_24h?: boolean }).remind_24h !== false;
    const remind3 = (row as { remind_3h?: boolean }).remind_3h !== false;
    const remindOd = (row as { remind_overdue?: boolean }).remind_overdue !== false;

    const { data: taskRows, error: tErr } = await supabase
      .from("deadline_tasks")
      .select("task_id, payload")
      .eq("user_id", userId);

    if (tErr) {
      console.error("tasks", userId, tErr);
      continue;
    }

    const completedIds: string[] = [];
    const activeTasks: { task_id: string; payload: TaskPayload }[] = [];

    for (const tr of taskRows ?? []) {
      const task_id = (tr as { task_id: string }).task_id;
      const payload = (tr as { payload: TaskPayload }).payload;
      if (!payload || typeof payload !== "object") continue;
      if (payload.status === "completed") {
        completedIds.push(task_id);
        continue;
      }
      const due = dueMs(payload);
      if (due == null) continue;
      activeTasks.push({ task_id, payload });
    }

    if (completedIds.length > 0) {
      await supabase
        .from("deadline_reminder_events")
        .delete()
        .eq("user_id", userId)
        .eq("status", "pending")
        .in("task_id", completedIds);
    }

    const types: { t: ReminderType; on: boolean }[] = [
      { t: "24h_before", on: remind24 },
      { t: "3h_before", on: remind3 },
      { t: "overdue_once", on: remindOd },
    ];

    for (const { task_id, payload } of activeTasks) {
      const due = dueMs(payload);
      if (due == null) continue;

      for (const { t: rtype, on } of types) {
        if (!on) continue;
        const sched = scheduledFor(rtype, due);
        const nowIso = new Date().toISOString();

        const { data: existing } = await supabase
          .from("deadline_reminder_events")
          .select("id, status")
          .eq("user_id", userId)
          .eq("task_id", task_id)
          .eq("reminder_type", rtype)
          .maybeSingle();

        const ex = existing as { id?: string; status?: string } | null;
        if (ex?.status === "sent" || ex?.status === "failed") {
          continue;
        }

        if (ex?.status === "pending" && ex.id) {
          const { error: uErr } = await supabase
            .from("deadline_reminder_events")
            .update({
              scheduled_for: new Date(sched).toISOString(),
              updated_at: nowIso,
            })
            .eq("id", ex.id)
            .eq("status", "pending");
          if (!uErr) upserts++;
          continue;
        }

        if (ex?.status === "skipped") continue;

        const { error: iErr } = await supabase
          .from("deadline_reminder_events")
          .insert({
            user_id: userId,
            task_id,
            reminder_type: rtype,
            scheduled_for: new Date(sched).toISOString(),
            status: "pending",
            updated_at: nowIso,
            created_at: nowIso,
          });
        if (!iErr) upserts++;
        else if (!String(iErr.message).includes("duplicate")) {
          console.error("insert event", iErr);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, users: users.length, upserts }), {
    headers: { "Content-Type": "application/json" },
  });
});
