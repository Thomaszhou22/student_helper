import { createClient } from "jsr:@supabase/supabase-js@2";
Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("MY_SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
  const { data: settings } = await supabase.from("deadline_reminder_settings").select("*");
  const { data: tasks } = await supabase.from("deadline_tasks").select("task_id, payload, user_id");
  const { data: events } = await supabase.from("deadline_reminder_events").select("*");
  const now = new Date();
  return new Response(JSON.stringify({ now: now.toISOString(), settings, tasks, events }, null, 2), { headers: { "Content-Type": "application/json" } });
});
