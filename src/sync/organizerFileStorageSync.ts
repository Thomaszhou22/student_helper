/**
 * Optional per-file upload to Supabase Storage + organizer_file_cloud metadata.
 * Local IndexedDB remains source of truth for bytes; cloud is for cross-device sync.
 */
import type { User } from "@supabase/supabase-js";
import { buildOrganizerStorageObjectPath } from "../lib/safeOrganizerStoragePath";

export {
  buildOrganizerStorageObjectPath,
  buildSafeStoragePath,
} from "../lib/safeOrganizerStoragePath";
import { getSupabase } from "../lib/supabase";
import { STORAGE_QUOTA_EXCEEDED_CODE } from "../lib/storageQuota";
import type { OrganizerFileEntry } from "../studyOrganizerStorage";
import { ORGANIZER_MAX_FILE_BYTES } from "../studyOrganizerStorage";

export const ORGANIZER_STORAGE_BUCKET = "organizer-files";

/** Non-quota server-side failures — show generic user message, not raw Storage errors */
export const ORGANIZER_SYNC_UPLOAD_FAILED_CODE = "sync_upload_failed";

export const ORGANIZER_SYNC_FILE_TOO_LARGE_CODE = "file_too_large";

/**
 * Lossy JPEG re-encode for large images before upload. Falls back to original on failure.
 */
export async function compressImageBlobIfNeeded(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/")) return blob;
  if (blob.size <= ORGANIZER_MAX_FILE_BYTES * 0.5) return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const maxDim = 2048;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
    if (!out || out.size > blob.size) return blob;
    return out;
  } catch {
    return blob;
  }
}

export type UploadOrganizerFileResult =
  | { storagePath: string; error: null; code?: undefined }
  | {
      storagePath: null;
      error: Error;
      code?: string;
    };

/**
 * Upload one file to Storage and upsert `organizer_file_cloud` row.
 * Storage path is `{userId}/{fileId}{safeExt}` — never the raw display name.
 */
export async function uploadOrganizerFileToCloud(
  user: User,
  entry: OrganizerFileEntry,
  blob: Blob,
): Promise<UploadOrganizerFileResult> {
  let uploadBlob = blob;
  if (blob.type.startsWith("image/")) {
    uploadBlob = await compressImageBlobIfNeeded(blob);
  }
  if (uploadBlob.size > ORGANIZER_MAX_FILE_BYTES) {
    return {
      storagePath: null,
      error: new Error(ORGANIZER_SYNC_FILE_TOO_LARGE_CODE),
      code: ORGANIZER_SYNC_FILE_TOO_LARGE_CODE,
    };
  }

  const sb = getSupabase();
  const uid = user.id;
  const contentType =
    uploadBlob.type || entry.type || "application/octet-stream";

  const path = buildOrganizerStorageObjectPath(
    uid,
    entry.id,
    entry.name,
    contentType,
  );

  const { error: upErr } = await sb.storage
    .from(ORGANIZER_STORAGE_BUCKET)
    .upload(path, uploadBlob, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (upErr) {
    if (import.meta.env.DEV) {
      console.warn("[organizer upload] storage error", upErr.message);
    }
    return {
      storagePath: null,
      error: new Error(ORGANIZER_SYNC_UPLOAD_FAILED_CODE),
      code: ORGANIZER_SYNC_UPLOAD_FAILED_CODE,
    };
  }

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "register_organizer_cloud_file",
    {
      p_file_id: entry.id,
      p_subject_id: entry.subjectId,
      p_name: entry.name,
      p_size: uploadBlob.size,
      p_type: contentType,
      p_storage_path: path,
    },
  );

  if (rpcErr) {
    if (import.meta.env.DEV) {
      console.warn("[organizer upload] rpc error", rpcErr.message);
    }
    void sb.storage.from(ORGANIZER_STORAGE_BUCKET).remove([path]);
    return {
      storagePath: null,
      error: new Error(ORGANIZER_SYNC_UPLOAD_FAILED_CODE),
      code: ORGANIZER_SYNC_UPLOAD_FAILED_CODE,
    };
  }

  const row = rpcData as { ok?: boolean; code?: string } | null;
  if (!row?.ok) {
    void sb.storage.from(ORGANIZER_STORAGE_BUCKET).remove([path]);
    const code = row?.code ?? "register_failed";
    if (code === STORAGE_QUOTA_EXCEEDED_CODE) {
      return {
        storagePath: null,
        error: new Error(STORAGE_QUOTA_EXCEEDED_CODE),
        code: STORAGE_QUOTA_EXCEEDED_CODE,
      };
    }
    if (import.meta.env.DEV) {
      console.warn("[organizer upload] register rejected", row);
    }
    return {
      storagePath: null,
      error: new Error(ORGANIZER_SYNC_UPLOAD_FAILED_CODE),
      code: ORGANIZER_SYNC_UPLOAD_FAILED_CODE,
    };
  }

  return { storagePath: path, error: null };
}

export async function downloadOrganizerFileFromCloud(
  storagePath: string,
): Promise<{ blob: Blob | null; error: Error | null }> {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(ORGANIZER_STORAGE_BUCKET)
    .download(storagePath);
  if (error) return { blob: null, error: new Error(error.message) };
  return { blob: data, error: null };
}

/**
 * Remove object from Storage and metadata row. Call when user removes a synced file.
 */
export async function deleteOrganizerFileFromCloud(
  _user: User,
  fileId: string,
  storagePath: string,
): Promise<{ error: Error | null }> {
  const sb = getSupabase();

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "unregister_organizer_cloud_file",
    { p_file_id: fileId },
  );

  if (rpcErr) return { error: new Error(rpcErr.message) };

  const rpcPath = (rpcData as { storage_path?: string } | null)?.storage_path;
  const pathToRemove = rpcPath ?? storagePath;
  if (!pathToRemove) return { error: null };

  const { error: stErr } = await sb.storage
    .from(ORGANIZER_STORAGE_BUCKET)
    .remove([pathToRemove]);
  if (stErr) return { error: new Error(stErr.message) };
  return { error: null };
}
