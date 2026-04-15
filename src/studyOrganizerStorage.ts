/** localStorage JSON for subjects, notes, links, and file metadata. */
export const ORGANIZER_STORAGE_KEY = "student-tools-study-organizer-v1";

const IDB_NAME = "student-tools-organizer-files";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

export type OrganizerSubject = {
  id: string;
  name: string;
  /** Tailwind color name for dot/badge, e.g. "blue" */
  color: string;
  /** ISO — for cloud sync LWW; set on add/rename */
  clientUpdatedAt?: string;
};

export type OrganizerNote = {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  /** ISO string */
  updatedAt: string;
  pinned?: boolean;
};

export type OrganizerLink = {
  id: string;
  subjectId: string;
  title: string;
  url: string;
  description?: string;
  /** ISO — for cloud sync LWW; set on add/edit */
  clientUpdatedAt?: string;
};

export type OrganizerFileSyncStatus =
  | "local"
  | "uploading"
  | "synced"
  | "error";

export type OrganizerFileEntry = {
  id: string;
  subjectId: string;
  name: string;
  size: number;
  type: string;
  /** ISO string — when the entry was added */
  createdAt?: string;
  /** Per-file cloud sync; default local-only until user syncs */
  syncStatus?: OrganizerFileSyncStatus;
  /** Supabase Storage path inside `organizer-files` bucket */
  storagePath?: string;
  /** ISO — when last successfully uploaded */
  syncedAt?: string;
  syncError?: string;
};

export type OrganizerPersisted = {
  subjects: OrganizerSubject[];
  notes: OrganizerNote[];
  links: OrganizerLink[];
  files: OrganizerFileEntry[];
};

export const SUBJECT_COLOR_OPTIONS = [
  "blue",
  "indigo",
  "violet",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "slate",
] as const;

export function newOrganizerId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadOrganizerState(): OrganizerPersisted {
  if (typeof window === "undefined") {
    return emptyState();
  }
  try {
    const raw = localStorage.getItem(ORGANIZER_STORAGE_KEY);
    if (!raw) return emptyState();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyState();
    const o = data as Record<string, unknown>;
    return {
      subjects: Array.isArray(o.subjects) ? parseSubjects(o.subjects) : [],
      notes: Array.isArray(o.notes) ? parseNotes(o.notes) : [],
      links: Array.isArray(o.links) ? parseLinks(o.links) : [],
      files: Array.isArray(o.files) ? parseFiles(o.files) : [],
    };
  } catch {
    return emptyState();
  }
}

function emptyState(): OrganizerPersisted {
  return { subjects: [], notes: [], links: [], files: [] };
}

function parseSubjects(arr: unknown[]): OrganizerSubject[] {
  const out: OrganizerSubject[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : newOrganizerId();
    const name = typeof r.name === "string" ? r.name : "Subject";
    const color =
      typeof r.color === "string" && r.color ? r.color : "blue";
    const clientUpdatedAt =
      typeof r.clientUpdatedAt === "string" ? r.clientUpdatedAt : undefined;
    out.push({
      id,
      name,
      color,
      ...(clientUpdatedAt ? { clientUpdatedAt } : {}),
    });
  }
  return out;
}

function parseNotes(arr: unknown[]): OrganizerNote[] {
  const out: OrganizerNote[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.subjectId !== "string") continue;
    out.push({
      id: typeof r.id === "string" ? r.id : newOrganizerId(),
      subjectId: r.subjectId,
      title: typeof r.title === "string" ? r.title : "",
      content: typeof r.content === "string" ? r.content : "",
      updatedAt:
        typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
      pinned: r.pinned === true,
    });
  }
  return out;
}

function parseLinks(arr: unknown[]): OrganizerLink[] {
  const out: OrganizerLink[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.subjectId !== "string") continue;
    const clientUpdatedAt =
      typeof r.clientUpdatedAt === "string" ? r.clientUpdatedAt : undefined;
    out.push({
      id: typeof r.id === "string" ? r.id : newOrganizerId(),
      subjectId: r.subjectId,
      title: typeof r.title === "string" ? r.title : "",
      url: typeof r.url === "string" ? r.url : "",
      description:
        typeof r.description === "string" ? r.description : undefined,
      ...(clientUpdatedAt ? { clientUpdatedAt } : {}),
    });
  }
  return out;
}

function parseFiles(arr: unknown[]): OrganizerFileEntry[] {
  const out: OrganizerFileEntry[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.subjectId !== "string") continue;
    const createdAt =
      typeof r.createdAt === "string" ? r.createdAt : undefined;
    const syncStatusRaw = r.syncStatus;
    const syncStatus =
      syncStatusRaw === "local" ||
      syncStatusRaw === "uploading" ||
      syncStatusRaw === "synced" ||
      syncStatusRaw === "error"
        ? syncStatusRaw
        : undefined;
    const storagePath =
      typeof r.storagePath === "string" ? r.storagePath : undefined;
    const syncedAt =
      typeof r.syncedAt === "string" ? r.syncedAt : undefined;
    const syncError =
      typeof r.syncError === "string" ? r.syncError : undefined;
    out.push({
      id: typeof r.id === "string" ? r.id : newOrganizerId(),
      subjectId: r.subjectId,
      name: typeof r.name === "string" ? r.name : "file",
      size: typeof r.size === "number" ? r.size : 0,
      type: typeof r.type === "string" ? r.type : "",
      ...(createdAt ? { createdAt } : {}),
      ...(syncStatus ? { syncStatus } : {}),
      ...(storagePath ? { storagePath } : {}),
      ...(syncedAt ? { syncedAt } : {}),
      ...(syncError ? { syncError } : {}),
    });
  }
  return out;
}

export function saveOrganizerState(state: OrganizerPersisted): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORGANIZER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

let idbDb: IDBDatabase | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (idbDb) return Promise.resolve(idbDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      idbDb = req.result;
      resolve(idbDb);
    };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

export async function saveOrganizerFileBlob(id: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(blob, id);
  });
}

export async function getOrganizerFileBlob(
  id: string,
): Promise<Blob | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(id);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function deleteOrganizerFileBlob(id: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).delete(id);
  });
}

/** Max single file size for MVP (bytes). */
export const ORGANIZER_MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Hint for `<input type="file" accept="…">` — validation uses {@link isOrganizerAcceptedFile}. */
export const ORGANIZER_FILE_INPUT_ACCEPT =
  "image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,text/plain";

const OFFICE_MIME = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const EXT_OK = new Set([
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
]);

function normalizedMime(file: File): string {
  const raw = file.type?.trim().toLowerCase() ?? "";
  return raw.split(";")[0]?.trim() ?? "";
}

/** Whether the file can be stored in the organizer (PDFs, images, common docs). */
export function isOrganizerAcceptedFile(file: File): boolean {
  const mime = normalizedMime(file);
  if (mime) {
    if (mime === "application/pdf") return true;
    if (mime.startsWith("image/")) return true;
    if (mime === "text/plain") return true;
    if (OFFICE_MIME.has(mime)) return true;
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return EXT_OK.has(ext);
}

export function isValidHttpUrl(raw: string): boolean {
  const s = raw.trim();
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
