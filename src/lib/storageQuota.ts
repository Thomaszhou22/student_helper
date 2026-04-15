import { getSupabase } from "./supabase";

export const STORAGE_QUOTA_EXCEEDED_CODE = "quota_exceeded";

export type MyStorageQuota = {
  usedBytes: number;
  maxBytes: number;
};

/**
 * Current user's cloud storage quota (from RLS-protected tables).
 */
export async function fetchMyStorageQuota(
  userId: string,
): Promise<MyStorageQuota | null> {
  const sb = getSupabase();
  const [qRes, uRes] = await Promise.all([
    sb
      .from("user_storage_quota")
      .select("max_storage_bytes")
      .eq("user_id", userId)
      .maybeSingle(),
    sb
      .from("user_storage_usage")
      .select("used_storage_bytes")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (qRes.error || uRes.error) return null;
  const maxBytes =
    typeof qRes.data?.max_storage_bytes === "number"
      ? qRes.data.max_storage_bytes
      : 52_428_800;
  const usedBytes =
    typeof uRes.data?.used_storage_bytes === "number"
      ? uRes.data.used_storage_bytes
      : 0;
  return { usedBytes, maxBytes };
}

export function formatStorageMb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function storageUsageRatio(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, used / max);
}
