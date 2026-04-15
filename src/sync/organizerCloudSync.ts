/**
 * Study Organizer cloud sync (Supabase): subjects, notes, links, optional file metadata.
 *
 * Merge: union by id; last-write-wins using row updated_at vs local timestamps.
 * Deletes: `organizer_sync_deletions` + local tombstones so removals propagate across devices.
 * File blobs: optional per-file upload via `organizerFileStorageSync` + `organizer_file_cloud`.
 */
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { ORGANIZER_STORAGE_BUCKET } from "./organizerFileStorageSync";
import type {
  OrganizerFileEntry,
  OrganizerLink,
  OrganizerNote,
  OrganizerPersisted,
  OrganizerSubject,
} from "../studyOrganizerStorage";

export type OrganizerCloudSubjectRow = {
  subject_id: string;
  payload: unknown;
  updated_at: string;
};

export type OrganizerCloudNoteRow = {
  note_id: string;
  subject_id: string;
  payload: unknown;
  updated_at: string;
};

export type OrganizerCloudLinkRow = {
  link_id: string;
  subject_id: string;
  payload: unknown;
  updated_at: string;
};

export type OrganizerDeletionRow = {
  entity: "subject" | "note" | "link" | "file";
  entity_id: string;
  deleted_at: string;
};

export type OrganizerCloudFileRow = {
  file_id: string;
  subject_id: string;
  name: string;
  size: number;
  type: string;
  storage_path: string;
  updated_at: string;
};

/** Tombstones queued until the next successful push (then cleared). */
export type OrganizerSyncMeta = {
  tombstoneSubjectIds?: string[];
  tombstoneNoteIds?: string[];
  tombstoneLinkIds?: string[];
  tombstoneFileIds?: string[];
};

export const ORGANIZER_SYNC_META_KEY = "student-tools-organizer-sync-meta";

const TOMBSTONE_CAP = 500;

function capTombstoneList(ids: string[]): string[] {
  return ids.slice(-TOMBSTONE_CAP);
}

export function loadOrganizerSyncMeta(): OrganizerSyncMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ORGANIZER_SYNC_META_KEY);
    if (!raw) return {};
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== "object") return {};
    const r = o as Record<string, unknown>;
    const parseIds = (k: string): string[] | undefined => {
      if (!Array.isArray(r[k])) return undefined;
      return r[k].filter((x): x is string => typeof x === "string");
    };
    return {
      tombstoneSubjectIds: parseIds("tombstoneSubjectIds"),
      tombstoneNoteIds: parseIds("tombstoneNoteIds"),
      tombstoneLinkIds: parseIds("tombstoneLinkIds"),
      tombstoneFileIds: parseIds("tombstoneFileIds"),
    };
  } catch {
    return {};
  }
}

export function saveOrganizerSyncMeta(meta: OrganizerSyncMeta): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORGANIZER_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function mergeTombstoneIds(
  prev: string[] | undefined,
  id: string,
): string[] {
  return capTombstoneList(Array.from(new Set([...(prev ?? []), id])));
}

export function addOrganizerSubjectTombstone(subjectId: string): void {
  const m = loadOrganizerSyncMeta();
  saveOrganizerSyncMeta({
    ...m,
    tombstoneSubjectIds: mergeTombstoneIds(m.tombstoneSubjectIds, subjectId),
  });
}

export function addOrganizerNoteTombstone(noteId: string): void {
  const m = loadOrganizerSyncMeta();
  saveOrganizerSyncMeta({
    ...m,
    tombstoneNoteIds: mergeTombstoneIds(m.tombstoneNoteIds, noteId),
  });
}

export function addOrganizerLinkTombstone(linkId: string): void {
  const m = loadOrganizerSyncMeta();
  saveOrganizerSyncMeta({
    ...m,
    tombstoneLinkIds: mergeTombstoneIds(m.tombstoneLinkIds, linkId),
  });
}

export function addOrganizerFileTombstone(fileId: string): void {
  const m = loadOrganizerSyncMeta();
  saveOrganizerSyncMeta({
    ...m,
    tombstoneFileIds: mergeTombstoneIds(m.tombstoneFileIds, fileId),
  });
}

export function clearOrganizerTombstones(): void {
  saveOrganizerSyncMeta({});
}

/** Remove only ids that were part of a successful push (keeps tombstones added during the request). */
function removeProcessedOrganizerTombstones(processed: OrganizerSyncMeta): void {
  const cur = loadOrganizerSyncMeta();
  const sub = new Set(processed.tombstoneSubjectIds ?? []);
  const note = new Set(processed.tombstoneNoteIds ?? []);
  const link = new Set(processed.tombstoneLinkIds ?? []);
  const file = new Set(processed.tombstoneFileIds ?? []);
  const next: OrganizerSyncMeta = {
    tombstoneSubjectIds: (cur.tombstoneSubjectIds ?? []).filter((id) => !sub.has(id)),
    tombstoneNoteIds: (cur.tombstoneNoteIds ?? []).filter((id) => !note.has(id)),
    tombstoneLinkIds: (cur.tombstoneLinkIds ?? []).filter((id) => !link.has(id)),
    tombstoneFileIds: (cur.tombstoneFileIds ?? []).filter((id) => !file.has(id)),
  };
  if (
    (next.tombstoneSubjectIds?.length ?? 0) === 0 &&
    (next.tombstoneNoteIds?.length ?? 0) === 0 &&
    (next.tombstoneLinkIds?.length ?? 0) === 0 &&
    (next.tombstoneFileIds?.length ?? 0) === 0
  ) {
    saveOrganizerSyncMeta({});
  } else {
    saveOrganizerSyncMeta(next);
  }
}

function isoMs(s: string | undefined): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Stagger synthetic timestamps so legacy rows without clientUpdatedAt still merge deterministically. */
function withStaggeredSubjectTimes(subjects: OrganizerSubject[]): OrganizerSubject[] {
  let i = 0;
  const base = Date.now();
  return subjects.map((s) => ({
    ...s,
    clientUpdatedAt:
      s.clientUpdatedAt ?? new Date(base + i++).toISOString(),
  }));
}

function withStaggeredLinkTimes(links: OrganizerLink[]): OrganizerLink[] {
  let i = 0;
  const base = Date.now();
  return links.map((l) => ({
    ...l,
    clientUpdatedAt:
      l.clientUpdatedAt ?? new Date(base + i++).toISOString(),
  }));
}

function parseSubjectPayload(raw: unknown): OrganizerSubject | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const name = typeof r.name === "string" ? r.name : "";
  const color = typeof r.color === "string" && r.color ? r.color : "blue";
  if (!id) return null;
  const clientUpdatedAt =
    typeof r.clientUpdatedAt === "string" ? r.clientUpdatedAt : undefined;
  return {
    id,
    name,
    color,
    ...(clientUpdatedAt ? { clientUpdatedAt } : {}),
  };
}

function parseNotePayload(raw: unknown): OrganizerNote | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.subjectId !== "string") return null;
  const updatedAt =
    typeof r.updatedAt === "string"
      ? r.updatedAt
      : new Date().toISOString();
  return {
    id: r.id,
    subjectId: r.subjectId,
    title: typeof r.title === "string" ? r.title : "",
    content: typeof r.content === "string" ? r.content : "",
    updatedAt,
    pinned: r.pinned === true,
  };
}

function parseLinkPayload(raw: unknown): OrganizerLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.subjectId !== "string") return null;
  const clientUpdatedAt =
    typeof r.clientUpdatedAt === "string" ? r.clientUpdatedAt : undefined;
  return {
    id: r.id,
    subjectId: r.subjectId,
    title: typeof r.title === "string" ? r.title : "",
    url: typeof r.url === "string" ? r.url : "",
    description:
      typeof r.description === "string" ? r.description : undefined,
    ...(clientUpdatedAt ? { clientUpdatedAt } : {}),
  };
}

function normalizeSubjectWin(s: OrganizerSubject): OrganizerSubject {
  return {
    ...s,
    clientUpdatedAt: s.clientUpdatedAt ?? new Date().toISOString(),
  };
}

function mergeSubjectsLww(
  localSubs: OrganizerSubject[],
  cloudRows: OrganizerCloudSubjectRow[],
): OrganizerSubject[] {
  const localById = new Map(localSubs.map((s) => [s.id, s]));
  const cloudById = new Map(cloudRows.map((r) => [r.subject_id, r]));
  const ids = new Set<string>([...localById.keys(), ...cloudById.keys()]);
  const out: OrganizerSubject[] = [];
  for (const id of ids) {
    const loc = localById.get(id);
    const crow = cloudById.get(id);
    if (!crow) {
      if (loc) out.push(normalizeSubjectWin(loc));
      continue;
    }
    const cloudParsed = parseSubjectPayload(crow.payload);
    if (!cloudParsed) {
      if (loc) out.push(normalizeSubjectWin(loc));
      continue;
    }
    if (!loc) {
      out.push({
        ...cloudParsed,
        id: crow.subject_id,
        clientUpdatedAt: crow.updated_at,
      });
      continue;
    }
    const localMs = isoMs(loc.clientUpdatedAt);
    const cloudMs = isoMs(crow.updated_at);
    if (cloudMs > localMs) {
      out.push({
        ...cloudParsed,
        id: crow.subject_id,
        clientUpdatedAt: crow.updated_at,
      });
    } else {
      out.push(normalizeSubjectWin(loc));
    }
  }
  return out;
}

function mergeNotesLww(
  localNotes: OrganizerNote[],
  cloudRows: OrganizerCloudNoteRow[],
  subjectIds: Set<string>,
): OrganizerNote[] {
  const localById = new Map(localNotes.map((n) => [n.id, n]));
  const cloudById = new Map(cloudRows.map((r) => [r.note_id, r]));
  const ids = new Set<string>([...localById.keys(), ...cloudById.keys()]);
  const out: OrganizerNote[] = [];
  for (const id of ids) {
    const loc = localById.get(id);
    const crow = cloudById.get(id);
    if (!crow) {
      if (loc && subjectIds.has(loc.subjectId)) out.push(loc);
      continue;
    }
    const cloudParsed = parseNotePayload(crow.payload);
    if (!cloudParsed) {
      if (loc && subjectIds.has(loc.subjectId)) out.push(loc);
      continue;
    }
    if (!loc) {
      const sid = crow.subject_id;
      if (subjectIds.has(sid)) {
        out.push({
          ...cloudParsed,
          id: crow.note_id,
          subjectId: sid,
          updatedAt: crow.updated_at,
        });
      }
      continue;
    }
    if (!subjectIds.has(loc.subjectId)) continue;
    const localMs = isoMs(loc.updatedAt);
    const cloudMs = isoMs(crow.updated_at);
    if (cloudMs > localMs) {
      const sid = crow.subject_id;
      if (subjectIds.has(sid)) {
        out.push({
          ...cloudParsed,
          id: crow.note_id,
          subjectId: sid,
          updatedAt: crow.updated_at,
        });
      }
    } else {
      out.push(loc);
    }
  }
  return out;
}

function mergeLinksLww(
  localLinks: OrganizerLink[],
  cloudRows: OrganizerCloudLinkRow[],
  subjectIds: Set<string>,
): OrganizerLink[] {
  const localById = new Map(localLinks.map((l) => [l.id, l]));
  const cloudById = new Map(cloudRows.map((r) => [r.link_id, r]));
  const ids = new Set<string>([...localById.keys(), ...cloudById.keys()]);
  const out: OrganizerLink[] = [];
  for (const id of ids) {
    const loc = localById.get(id);
    const crow = cloudById.get(id);
    if (!crow) {
      if (loc && subjectIds.has(loc.subjectId)) {
        out.push({
          ...loc,
          clientUpdatedAt: loc.clientUpdatedAt ?? new Date().toISOString(),
        });
      }
      continue;
    }
    const cloudParsed = parseLinkPayload(crow.payload);
    if (!cloudParsed) {
      if (loc && subjectIds.has(loc.subjectId)) {
        out.push({
          ...loc,
          clientUpdatedAt: loc.clientUpdatedAt ?? new Date().toISOString(),
        });
      }
      continue;
    }
    if (!loc) {
      const sid = crow.subject_id;
      if (subjectIds.has(sid)) {
        out.push({
          ...cloudParsed,
          id: crow.link_id,
          subjectId: sid,
          clientUpdatedAt: crow.updated_at,
        });
      }
      continue;
    }
    if (!subjectIds.has(loc.subjectId)) continue;
    const localMs = isoMs(loc.clientUpdatedAt);
    const cloudMs = isoMs(crow.updated_at);
    if (cloudMs > localMs) {
      const sid = crow.subject_id;
      if (subjectIds.has(sid)) {
        out.push({
          ...cloudParsed,
          id: crow.link_id,
          subjectId: sid,
          clientUpdatedAt: crow.updated_at,
        });
      }
    } else {
      out.push({
        ...loc,
        clientUpdatedAt: loc.clientUpdatedAt ?? new Date().toISOString(),
      });
    }
  }
  return out;
}

function mergeFilesLww(
  localFiles: OrganizerFileEntry[],
  cloudRows: OrganizerCloudFileRow[],
  subjectIdSet: Set<string>,
): OrganizerFileEntry[] {
  const localById = new Map(localFiles.map((f) => [f.id, f]));
  const cloudById = new Map(cloudRows.map((r) => [r.file_id, r]));
  const ids = new Set<string>([...localById.keys(), ...cloudById.keys()]);
  const out: OrganizerFileEntry[] = [];
  for (const id of ids) {
    const loc = localById.get(id);
    const crow = cloudById.get(id);
    if (loc?.syncStatus === "uploading") {
      out.push(loc);
      continue;
    }
    if (!crow) {
      if (loc && subjectIdSet.has(loc.subjectId)) out.push(loc);
      continue;
    }
    const cloudMs = isoMs(crow.updated_at);
    if (!loc) {
      if (subjectIdSet.has(crow.subject_id)) {
        out.push({
          id: crow.file_id,
          subjectId: crow.subject_id,
          name: crow.name,
          size: crow.size,
          type: crow.type,
          syncStatus: "synced",
          storagePath: crow.storage_path,
          syncedAt: crow.updated_at,
        });
      }
      continue;
    }
    if (!subjectIdSet.has(loc.subjectId)) continue;
    const localMs = isoMs(loc.syncedAt ?? loc.createdAt ?? "");
    if (cloudMs > localMs) {
      if (subjectIdSet.has(crow.subject_id)) {
        out.push({
          ...loc,
          subjectId: crow.subject_id,
          name: crow.name,
          size: crow.size,
          type: crow.type,
          syncStatus: "synced",
          storagePath: crow.storage_path,
          syncedAt: crow.updated_at,
          syncError: undefined,
        });
      }
    } else {
      out.push(loc);
    }
  }
  return out;
}

/**
 * Apply server-side deletion log after LWW merge so another device's delete wins over stale local rows.
 */
export function applyOrganizerDeletions(
  merged: OrganizerPersisted,
  deletions: OrganizerDeletionRow[],
): OrganizerPersisted {
  if (deletions.length === 0) return merged;

  const subjectDel = new Map<string, number>();
  const noteDel = new Map<string, number>();
  const linkDel = new Map<string, number>();
  const fileDel = new Map<string, number>();
  for (const d of deletions) {
    const ms = isoMs(d.deleted_at);
    if (d.entity === "subject") subjectDel.set(d.entity_id, ms);
    else if (d.entity === "note") noteDel.set(d.entity_id, ms);
    else if (d.entity === "link") linkDel.set(d.entity_id, ms);
    else if (d.entity === "file") fileDel.set(d.entity_id, ms);
  }

  const subjects = merged.subjects.filter((s) => {
    const delMs = subjectDel.get(s.id);
    if (delMs == null) return true;
    return isoMs(s.clientUpdatedAt) > delMs;
  });
  const subjectIds = new Set(subjects.map((s) => s.id));

  const notes = merged.notes.filter((n) => {
    if (!subjectIds.has(n.subjectId)) return false;
    const delMs = noteDel.get(n.id);
    if (delMs != null && isoMs(n.updatedAt) <= delMs) return false;
    return true;
  });

  const links = merged.links.filter((l) => {
    if (!subjectIds.has(l.subjectId)) return false;
    const delMs = linkDel.get(l.id);
    const lm = isoMs(l.clientUpdatedAt);
    if (delMs != null && lm <= delMs) return false;
    return true;
  });

  const files = merged.files.filter((f) => {
    if (!subjectIds.has(f.subjectId)) return false;
    const delMs = fileDel.get(f.id);
    if (delMs == null) return true;
    const lm = isoMs(f.syncedAt ?? f.createdAt ?? "");
    return lm > delMs;
  });

  return { subjects, notes, links, files };
}

/**
 * Merge local + cloud rows. File metadata merges from `organizer_file_cloud`; blobs stay local IndexedDB unless user downloads.
 */
export function mergeOrganizerData(
  local: OrganizerPersisted,
  cloud: {
    subjects: OrganizerCloudSubjectRow[];
    notes: OrganizerCloudNoteRow[];
    links: OrganizerCloudLinkRow[];
    files?: OrganizerCloudFileRow[];
  },
  deletions: OrganizerDeletionRow[] = [],
): OrganizerPersisted {
  const localSubs = withStaggeredSubjectTimes(local.subjects);
  const localLinksPrep = withStaggeredLinkTimes(local.links);

  const mergedSubjects = mergeSubjectsLww(localSubs, cloud.subjects);
  const subjectIdSet = new Set(mergedSubjects.map((s) => s.id));

  const mergedNotes = mergeNotesLww(local.notes, cloud.notes, subjectIdSet);
  const mergedLinks = mergeLinksLww(localLinksPrep, cloud.links, subjectIdSet);
  const mergedFiles = mergeFilesLww(
    local.files,
    cloud.files ?? [],
    subjectIdSet,
  );

  const merged: OrganizerPersisted = {
    subjects: mergedSubjects,
    notes: mergedNotes,
    links: mergedLinks,
    files: mergedFiles,
  };

  return applyOrganizerDeletions(merged, deletions);
}

export async function loadOrganizerFromCloud(user: User): Promise<{
  subjects: OrganizerCloudSubjectRow[];
  notes: OrganizerCloudNoteRow[];
  links: OrganizerCloudLinkRow[];
  fileRows: OrganizerCloudFileRow[];
  deletions: OrganizerDeletionRow[];
  error: Error | null;
}> {
  const sb = getSupabase();
  const uid = user.id;

  const [subRes, noteRes, linkRes, fileRes, delRes] = await Promise.all([
    sb
      .from("organizer_subjects")
      .select("subject_id, payload, updated_at")
      .eq("user_id", uid),
    sb
      .from("organizer_notes")
      .select("note_id, subject_id, payload, updated_at")
      .eq("user_id", uid),
    sb
      .from("organizer_links")
      .select("link_id, subject_id, payload, updated_at")
      .eq("user_id", uid),
    sb
      .from("organizer_file_cloud")
      .select(
        "file_id, subject_id, name, size, type, storage_path, updated_at",
      )
      .eq("user_id", uid),
    sb
      .from("organizer_sync_deletions")
      .select("entity, entity_id, deleted_at")
      .eq("user_id", uid),
  ]);

  if (subRes.error) {
    return {
      subjects: [],
      notes: [],
      links: [],
      fileRows: [],
      deletions: [],
      error: new Error(subRes.error.message),
    };
  }
  if (noteRes.error) {
    return {
      subjects: [],
      notes: [],
      links: [],
      fileRows: [],
      deletions: [],
      error: new Error(noteRes.error.message),
    };
  }
  if (linkRes.error) {
    return {
      subjects: [],
      notes: [],
      links: [],
      fileRows: [],
      deletions: [],
      error: new Error(linkRes.error.message),
    };
  }
  if (fileRes.error) {
    return {
      subjects: [],
      notes: [],
      links: [],
      fileRows: [],
      deletions: [],
      error: new Error(fileRes.error.message),
    };
  }
  if (delRes.error) {
    return {
      subjects: [],
      notes: [],
      links: [],
      fileRows: [],
      deletions: [],
      error: new Error(delRes.error.message),
    };
  }

  const subjects: OrganizerCloudSubjectRow[] = [];
  for (const row of subRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const subject_id = typeof r.subject_id === "string" ? r.subject_id : "";
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString();
    if (!subject_id || r.payload == null) continue;
    subjects.push({ subject_id, payload: r.payload, updated_at });
  }

  const notes: OrganizerCloudNoteRow[] = [];
  for (const row of noteRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const note_id = typeof r.note_id === "string" ? r.note_id : "";
    const subject_id = typeof r.subject_id === "string" ? r.subject_id : "";
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString();
    if (!note_id || !subject_id || r.payload == null) continue;
    notes.push({ note_id, subject_id, payload: r.payload, updated_at });
  }

  const links: OrganizerCloudLinkRow[] = [];
  for (const row of linkRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const link_id = typeof r.link_id === "string" ? r.link_id : "";
    const subject_id = typeof r.subject_id === "string" ? r.subject_id : "";
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString();
    if (!link_id || !subject_id || r.payload == null) continue;
    links.push({ link_id, subject_id, payload: r.payload, updated_at });
  }

  const fileRows: OrganizerCloudFileRow[] = [];
  for (const row of fileRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const file_id = typeof r.file_id === "string" ? r.file_id : "";
    const subject_id = typeof r.subject_id === "string" ? r.subject_id : "";
    const name = typeof r.name === "string" ? r.name : "file";
    const size = typeof r.size === "number" ? r.size : 0;
    const type = typeof r.type === "string" ? r.type : "";
    const storage_path =
      typeof r.storage_path === "string" ? r.storage_path : "";
    const updated_at =
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString();
    if (!file_id || !subject_id || !storage_path) continue;
    fileRows.push({
      file_id,
      subject_id,
      name,
      size,
      type,
      storage_path,
      updated_at,
    });
  }

  const deletions: OrganizerDeletionRow[] = [];
  for (const row of delRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const entity = r.entity;
    const entity_id = typeof r.entity_id === "string" ? r.entity_id : "";
    const deleted_at =
      typeof r.deleted_at === "string"
        ? r.deleted_at
        : new Date().toISOString();
    if (
      entity !== "subject" &&
      entity !== "note" &&
      entity !== "link" &&
      entity !== "file"
    ) {
      continue;
    }
    if (!entity_id) continue;
    deletions.push({ entity, entity_id, deleted_at });
  }

  return { subjects, notes, links, fileRows, deletions, error: null };
}

const UPSERT_CHUNK = 80;

export async function pushOrganizerToCloud(
  user: User,
  state: OrganizerPersisted,
  tombstones: OrganizerSyncMeta | null = null,
): Promise<{ error: Error | null }> {
  const sb = getSupabase();
  const uid = user.id;
  const now = new Date().toISOString();
  const ts = tombstones ?? loadOrganizerSyncMeta();
  const processedSnapshot: OrganizerSyncMeta = {
    tombstoneSubjectIds: [...(ts.tombstoneSubjectIds ?? [])],
    tombstoneNoteIds: [...(ts.tombstoneNoteIds ?? [])],
    tombstoneLinkIds: [...(ts.tombstoneLinkIds ?? [])],
    tombstoneFileIds: [...(ts.tombstoneFileIds ?? [])],
  };

  const subjectRows = state.subjects.map((s) => {
    const rowUpdated = s.clientUpdatedAt ?? now;
    return {
      user_id: uid,
      subject_id: s.id,
      payload: { ...s, clientUpdatedAt: rowUpdated },
      updated_at: rowUpdated,
    };
  });

  for (let i = 0; i < subjectRows.length; i += UPSERT_CHUNK) {
    const chunk = subjectRows.slice(i, i + UPSERT_CHUNK);
    const { error } = await sb.from("organizer_subjects").upsert(chunk, {
      onConflict: "user_id,subject_id",
    });
    if (error) return { error: new Error(error.message) };
  }

  const noteRows = state.notes.map((n) => {
    const rowUpdated = n.updatedAt;
    return {
      user_id: uid,
      note_id: n.id,
      subject_id: n.subjectId,
      payload: n,
      updated_at: rowUpdated,
    };
  });

  for (let i = 0; i < noteRows.length; i += UPSERT_CHUNK) {
    const chunk = noteRows.slice(i, i + UPSERT_CHUNK);
    const { error } = await sb.from("organizer_notes").upsert(chunk, {
      onConflict: "user_id,note_id",
    });
    if (error) return { error: new Error(error.message) };
  }

  const linkRows = state.links.map((l) => {
    const rowUpdated = l.clientUpdatedAt ?? now;
    return {
      user_id: uid,
      link_id: l.id,
      subject_id: l.subjectId,
      payload: { ...l, clientUpdatedAt: rowUpdated },
      updated_at: rowUpdated,
    };
  });

  for (let i = 0; i < linkRows.length; i += UPSERT_CHUNK) {
    const chunk = linkRows.slice(i, i + UPSERT_CHUNK);
    const { error } = await sb.from("organizer_links").upsert(chunk, {
      onConflict: "user_id,link_id",
    });
    if (error) return { error: new Error(error.message) };
  }

  const localSubjectIds = new Set(state.subjects.map((s) => s.id));
  const { data: existingSub, error: subListErr } = await sb
    .from("organizer_subjects")
    .select("subject_id")
    .eq("user_id", uid);
  if (subListErr) return { error: new Error(subListErr.message) };
  const delSub = (existingSub ?? [])
    .map((r) => (r as { subject_id: string }).subject_id)
    .filter((id) => !localSubjectIds.has(id));
  if (delSub.length > 0) {
    const { error: dErr } = await sb
      .from("organizer_subjects")
      .delete()
      .eq("user_id", uid)
      .in("subject_id", delSub);
    if (dErr) return { error: new Error(dErr.message) };
  }

  const localNoteIds = new Set(state.notes.map((n) => n.id));
  const { data: existingNotes, error: noteListErr } = await sb
    .from("organizer_notes")
    .select("note_id")
    .eq("user_id", uid);
  if (noteListErr) return { error: new Error(noteListErr.message) };
  const delNotes = (existingNotes ?? [])
    .map((r) => (r as { note_id: string }).note_id)
    .filter((id) => !localNoteIds.has(id));
  if (delNotes.length > 0) {
    const { error: dErr } = await sb
      .from("organizer_notes")
      .delete()
      .eq("user_id", uid)
      .in("note_id", delNotes);
    if (dErr) return { error: new Error(dErr.message) };
  }

  const localLinkIds = new Set(state.links.map((l) => l.id));
  const { data: existingLinks, error: linkListErr } = await sb
    .from("organizer_links")
    .select("link_id")
    .eq("user_id", uid);
  if (linkListErr) return { error: new Error(linkListErr.message) };
  const delLinks = (existingLinks ?? [])
    .map((r) => (r as { link_id: string }).link_id)
    .filter((id) => !localLinkIds.has(id));
  if (delLinks.length > 0) {
    const { error: dErr } = await sb
      .from("organizer_links")
      .delete()
      .eq("user_id", uid)
      .in("link_id", delLinks);
    if (dErr) return { error: new Error(dErr.message) };
  }

  const localFileIds = new Set(state.files.map((f) => f.id));
  const { data: existingFileMeta, error: fileMetaListErr } = await sb
    .from("organizer_file_cloud")
    .select("file_id, storage_path")
    .eq("user_id", uid);
  if (fileMetaListErr) return { error: new Error(fileMetaListErr.message) };
  for (const row of existingFileMeta ?? []) {
    const fid = (row as { file_id: string }).file_id;
    const sp = (row as { storage_path: string }).storage_path;
    if (localFileIds.has(fid)) continue;
    const { data: rpcData, error: rpcErr } = await sb.rpc(
      "unregister_organizer_cloud_file",
      { p_file_id: fid },
    );
    if (rpcErr) return { error: new Error(rpcErr.message) };
    const un = rpcData as { storage_path?: string; skipped?: boolean } | null;
    const pathToRemove = un?.storage_path ?? sp;
    if (pathToRemove) {
      await sb.storage.from(ORGANIZER_STORAGE_BUCKET).remove([pathToRemove]);
    }
  }

  const delRows: {
    user_id: string;
    entity: "subject" | "note" | "link" | "file";
    entity_id: string;
    deleted_at: string;
  }[] = [];
  for (const id of processedSnapshot.tombstoneSubjectIds ?? []) {
    delRows.push({
      user_id: uid,
      entity: "subject",
      entity_id: id,
      deleted_at: now,
    });
  }
  for (const id of processedSnapshot.tombstoneNoteIds ?? []) {
    delRows.push({
      user_id: uid,
      entity: "note",
      entity_id: id,
      deleted_at: now,
    });
  }
  for (const id of processedSnapshot.tombstoneLinkIds ?? []) {
    delRows.push({
      user_id: uid,
      entity: "link",
      entity_id: id,
      deleted_at: now,
    });
  }
  for (const id of processedSnapshot.tombstoneFileIds ?? []) {
    delRows.push({
      user_id: uid,
      entity: "file",
      entity_id: id,
      deleted_at: now,
    });
  }

  for (let i = 0; i < delRows.length; i += UPSERT_CHUNK) {
    const chunk = delRows.slice(i, i + UPSERT_CHUNK);
    const { error: delUpsertErr } = await sb
      .from("organizer_sync_deletions")
      .upsert(chunk, { onConflict: "user_id,entity,entity_id" });
    if (delUpsertErr) return { error: new Error(delUpsertErr.message) };
  }

  removeProcessedOrganizerTombstones(processedSnapshot);

  return { error: null };
}
