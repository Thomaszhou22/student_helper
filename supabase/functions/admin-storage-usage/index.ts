import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_TOTAL_MB = 1024;

Deno.serve(async (req) => {
  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Missing auth", { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get caller info
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }

    // Get total storage usage from user_storage_usage table
    const { data: usageData, error: usageError } = await supabase
      .from("user_storage_usage")
      .select("used_storage_bytes");

    if (usageError) {
      return new Response(JSON.stringify({ error: usageError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const totalUsedBytes = (usageData ?? []).reduce(
      (sum: number, row: { used_storage_bytes: number }) =>
        sum + (row.used_storage_bytes || 0),
      0,
    );

    return new Response(
      JSON.stringify({
        usedBytes: totalUsedBytes,
        usedMb: +(totalUsedBytes / (1024 * 1024)).toFixed(2),
        totalMb: PROJECT_TOTAL_MB,
        totalBytes: PROJECT_TOTAL_MB * 1024 * 1024,
        percent: +((totalUsedBytes / (PROJECT_TOTAL_MB * 1024 * 1024)) * 100).toFixed(1),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
