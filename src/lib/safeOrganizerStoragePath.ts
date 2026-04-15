/**
 * Supabase Storage keys must avoid raw user file names (Unicode, spaces, `Invalid key`, etc.).
 * Cloud object path: `{userId}/{fileId}{safeExt}` — display name stays in metadata only.
 */

/** Known safe extensions we accept from a filename tail or MIME fallback. */
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "heic",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "csv",
  "zip",
  "bin",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tif",
  "image/svg+xml": ".svg",
  "text/plain": ".txt",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "application/zip": ".zip",
};

const MAX_EXT_LEN = 12;

/**
 * Last path segment only — strips `../`, `C:\`, nested folders, and null bytes.
 */
export function basenameOnly(name: string): string {
  if (!name || typeof name !== "string") return "file";
  const noNulls = name.replace(/\0/g, "");
  const normalized = noNulls.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((p) => p !== "");
  const last = parts[parts.length - 1] ?? "file";
  return last.trim() || "file";
}

/**
 * Aggressive sanitizer for any filename-derived segment (e.g. future slugs).
 * NFC normalize, strip combining marks, replace unsafe chars, collapse whitespace, cap length.
 */
export function sanitizeFileNameForStorage(
  name: string,
  maxBaseLength = 80,
): string {
  const base = basenameOnly(name);
  let s = base
    .normalize("NFKC")
    .replace(/\p{M}/gu, "")
    .replace(/[/\\?#%&*:<>|"`;]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(/[^a-zA-Z0-9._\- ]/g, "_");
  s = s.replace(/\s+/g, "-");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^[._-]+|[._-]+$/g, "");

  if (!s) s = "file";
  return s.slice(0, maxBaseLength);
}

/**
 * Safe lowercase extension including dot, e.g. `.pdf`. Always ASCII.
 * Uses filename tail when allowed; otherwise MIME; fallback `.bin`.
 */
export function getSafeExtension(originalName: string, mimeType: string): string {
  const base = basenameOnly(originalName);
  const mime = (mimeType ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase() ?? "";

  const tailMatch = new RegExp(
    `\\.([a-zA-Z0-9]{1,${MAX_EXT_LEN}})$`,
    "u",
  ).exec(base);
  if (tailMatch) {
    const raw = tailMatch[1].toLowerCase();
    if (ALLOWED_EXTENSIONS.has(raw)) {
      const seg = raw === "jpeg" ? "jpg" : raw;
      return `.${seg}`;
    }
  }

  const fromMime = MIME_TO_EXT[mime];
  if (fromMime) return fromMime;

  if (mime.startsWith("image/")) {
    const sub = mime.slice("image/".length).split("+")[0];
    if (sub === "jpeg" || sub === "jpg") return ".jpg";
    if (ALLOWED_EXTENSIONS.has(sub) && sub.length <= MAX_EXT_LEN) return `.${sub}`;
    return ".img";
  }
  if (mime.startsWith("text/")) return ".txt";
  if (mime === "application/octet-stream") return ".bin";

  return ".bin";
}

/**
 * Final Storage object path. Does not include bucket name.
 * Format: `{userId}/{fileId}{ext}` — stable, short, ASCII-safe.
 */
export function buildOrganizerStorageObjectPath(
  userId: string,
  fileId: string,
  originalName: string,
  mimeType: string,
): string {
  const ext = getSafeExtension(originalName, mimeType);
  const safePath = `${userId}/${fileId}${ext}`;

  if (import.meta.env.DEV) {
    console.log("UPLOAD PATH DEBUG", {
      originalName,
      safePath,
      ext,
      mimeType,
    });
  }

  return safePath;
}

/** Generic name for the same path builder (organizer-specific defaults). */
export const buildSafeStoragePath = buildOrganizerStorageObjectPath;

/*
  Manual QA (sync upload uses path `{userId}/{fileId}{ext}`; display name stays in metadata):
  - 物理.docx, Math Notes Final (2).pdf, Chemistry Lab #3?.pdf
  - Screenshot 2026/04/15.png, ../secret.pdf, spaced   name   .jpg
  - a-very-long-...name....docx
*/
