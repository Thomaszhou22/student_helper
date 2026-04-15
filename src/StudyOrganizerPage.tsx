import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CloudUpload,
  Copy,
  ExternalLink,
  File as FileIcon,
  LayoutGrid,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import {
  CloudSyncBadge,
  type CloudSyncUiStatus,
} from "./components/CloudSyncBadge";
import { HubAuthNav } from "./components/HubAuthNav";
import { HubLanguageToggle } from "./components/HubLanguageToggle";
import { useHubUiLang, type HubUiLang } from "./context/HubUiLangContext";
import {
  addOrganizerFileTombstone,
  addOrganizerLinkTombstone,
  addOrganizerNoteTombstone,
  addOrganizerSubjectTombstone,
  loadOrganizerFromCloud,
  mergeOrganizerData,
  pushOrganizerToCloud,
} from "./sync/organizerCloudSync";
import {
  deleteOrganizerFileFromCloud,
  downloadOrganizerFileFromCloud,
  ORGANIZER_SYNC_FILE_TOO_LARGE_CODE,
  uploadOrganizerFileToCloud,
} from "./sync/organizerFileStorageSync";
import { useOnlineSyncRecovery } from "./sync/useOnlineSyncRecovery";
import {
  fetchMyStorageQuota,
  formatStorageMb,
  STORAGE_QUOTA_EXCEEDED_CODE,
  storageUsageRatio,
  type MyStorageQuota,
} from "./lib/storageQuota";
import {
  deleteOrganizerFileBlob,
  formatFileSize,
  getOrganizerFileBlob,
  isOrganizerAcceptedFile,
  isValidHttpUrl,
  loadOrganizerState,
  newOrganizerId,
  ORGANIZER_FILE_INPUT_ACCEPT,
  ORGANIZER_MAX_FILE_BYTES,
  saveOrganizerFileBlob,
  saveOrganizerState,
  SUBJECT_COLOR_OPTIONS,
  type OrganizerFileEntry,
  type OrganizerFileSyncStatus,
  type OrganizerLink,
  type OrganizerNote,
  type OrganizerPersisted,
  type OrganizerSubject,
} from "./studyOrganizerStorage";

type OrganizerTab = "notes" | "links" | "files";

type Translations = {
  backToHub: string;
  pageTitle: string;
  pageSubtitle: string;
  subjects: string;
  addSubject: string;
  notes: string;
  links: string;
  files: string;
  newNote: string;
  addLink: string;
  addFile: string;
  searchPlaceholder: string;
  emptySubjects: string;
  emptyNotes: string;
  emptyLinks: string;
  emptyFiles: string;
  subjectName: string;
  color: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  rename: string;
  noteTitle: string;
  noteContent: string;
  linkTitle: string;
  url: string;
  description: string;
  optional: string;
  lastEdited: string;
  openLink: string;
  download: string;
  removeFile: string;
  fileUnavailable: string;
  fileTooLarge: string;
  invalidUrl: string;
  confirmDeleteSubject: string;
  confirmDeleteNote: string;
  confirmDeleteLink: string;
  confirmDeleteFile: string;
  countsSummary: string;
  copyNote: string;
  copied: string;
  pin: string;
  unpin: string;
  subjectsToggle: string;
  fileStorageHint: string;
  add: string;
  noSearchResults: string;
  dropZoneLine1: string;
  dropZoneLine2: string;
  unsupportedFileType: string;
  fileAddedAt: string;
  cloudSyncLocalOnlyHint: string;
  fileSyncLocal: string;
  fileSyncUploading: string;
  fileSyncSynced: string;
  fileSyncError: string;
  fileSyncAction: string;
  fileRetryAction: string;
  fileLocalFirstHint: string;
  fileSyncNeedLogin: string;
  /** "{used}" and "{max}" are formatted sizes, e.g. 12 MB */
  storageUsedLine: string;
  fileSyncQuotaExceeded: string;
  fileSyncGenericFailed: string;
};

const translations: Record<HubUiLang, Translations> = {
  en: {
    backToHub: "Back to hub",
    pageTitle: "Study Organizer",
    pageSubtitle:
      "Organize your notes, links, and study files by subject.",
    subjects: "Subjects",
    addSubject: "Add subject",
    notes: "Notes",
    links: "Links",
    files: "Files",
    newNote: "New note",
    addLink: "Add link",
    addFile: "Add file",
    searchPlaceholder: "Search in this subject…",
    emptySubjects:
      "Create your first subject to start organizing your study materials.",
    emptyNotes: "No notes yet. Add one to capture ideas and summaries.",
    emptyLinks: "No links saved. Add YouTube, docs, or reading links.",
    emptyFiles:
      "Add files, screenshots, and study materials for this subject.",
    subjectName: "Subject name",
    color: "Color",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    rename: "Rename",
    noteTitle: "Title",
    noteContent: "Content",
    linkTitle: "Title",
    url: "URL",
    description: "Description",
    optional: "optional",
    lastEdited: "Edited",
    openLink: "Open",
    download: "Download",
    removeFile: "Remove",
    fileUnavailable: "File data missing (browser storage may have been cleared).",
    fileTooLarge: "File is too large (max 8 MB).",
    invalidUrl: "Enter a valid http(s) URL.",
    confirmDeleteSubject:
      "Delete this subject and all its notes, links, and files?",
    confirmDeleteNote: "Delete this note?",
    confirmDeleteLink: "Delete this link?",
    confirmDeleteFile: "Remove this file from the organizer?",
    countsSummary: "{notes} notes · {links} links · {files} files",
    copyNote: "Copy",
    copied: "Copied",
    pin: "Pin",
    unpin: "Unpin",
    subjectsToggle: "Subjects",
    fileStorageHint:
      "Files are stored in this browser (IndexedDB). Clearing site data may remove them.",
    add: "Add",
    noSearchResults: "No matches for your search.",
    dropZoneLine1: "Drag files here or click to upload",
    dropZoneLine2: "You can also paste images here",
    unsupportedFileType: "This file type is not supported yet.",
    fileAddedAt: "Added",
    cloudSyncLocalOnlyHint: "Log in to sync your study materials",
    fileSyncLocal: "Local",
    fileSyncUploading: "Syncing…",
    fileSyncSynced: "Synced",
    fileSyncError: "Sync failed",
    fileSyncAction: "Sync",
    fileRetryAction: "Retry",
    fileLocalFirstHint:
      "Files are stored locally by default. Sync only the ones you want in your account.",
    fileSyncNeedLogin: "Sign in to sync files to your account.",
    storageUsedLine: "Storage used: {used} / {max}",
    fileSyncQuotaExceeded: "This file would exceed your storage limit.",
    fileSyncGenericFailed:
      "Could not sync this file. Please try again.",
  },
  zh: {
    backToHub: "返回首页",
    pageTitle: "资料整理工具",
    pageSubtitle: "按学科整理你的笔记、链接和学习资料。",
    subjects: "学科",
    addSubject: "添加学科",
    notes: "笔记",
    links: "链接",
    files: "文件",
    newNote: "新建笔记",
    addLink: "添加链接",
    addFile: "添加文件",
    searchPlaceholder: "在当前学科中搜索…",
    emptySubjects: "创建你的第一个学科，开始整理学习资料。",
    emptyNotes: "还没有笔记，添加一条记录想法或摘要。",
    emptyLinks: "还没有链接，可添加视频、文档或阅读材料。",
    emptyFiles: "为这个学科添加文件、截图和学习资料。",
    subjectName: "学科名称",
    color: "颜色",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    rename: "重命名",
    noteTitle: "标题",
    noteContent: "内容",
    linkTitle: "标题",
    url: "链接",
    description: "说明",
    optional: "可选",
    lastEdited: "编辑于",
    openLink: "打开",
    download: "下载",
    removeFile: "删除",
    fileUnavailable: "找不到文件数据（可能已清除浏览器存储）。",
    fileTooLarge: "文件过大（最大 8 MB）。",
    invalidUrl: "请输入以 http:// 或 https:// 开头的有效链接。",
    confirmDeleteSubject: "确定删除该学科及其全部笔记、链接与文件？",
    confirmDeleteNote: "确定删除这条笔记？",
    confirmDeleteLink: "确定删除该链接？",
    confirmDeleteFile: "确定从整理工具中移除该文件？",
    countsSummary: "{notes} 条笔记 · {links} 条链接 · {files} 个文件",
    copyNote: "复制",
    copied: "已复制",
    pin: "置顶",
    unpin: "取消置顶",
    subjectsToggle: "学科",
    fileStorageHint:
      "文件保存在本浏览器（IndexedDB）。清除网站数据可能会删除它们。",
    add: "添加",
    noSearchResults: "没有匹配项。",
    dropZoneLine1: "将文件拖到这里，或点击上传",
    dropZoneLine2: "也可以在这里粘贴图片",
    unsupportedFileType: "暂不支持这种文件类型。",
    fileAddedAt: "添加于",
    cloudSyncLocalOnlyHint: "登录后可同步你的学习资料",
    fileSyncLocal: "仅本地",
    fileSyncUploading: "同步中…",
    fileSyncSynced: "已同步",
    fileSyncError: "同步失败",
    fileSyncAction: "同步",
    fileRetryAction: "重试",
    fileLocalFirstHint:
      "文件默认仅保存在本地，只有你选择同步的文件才会上传到账号。",
    fileSyncNeedLogin: "请先登录账号后再同步文件。",
    storageUsedLine: "已使用：{used} / {max}",
    fileSyncQuotaExceeded: "该文件会超出你的存储上限。",
    fileSyncGenericFailed: "该文件同步失败，请重试。",
  },
};

function effectiveFileSyncStatus(f: OrganizerFileEntry): OrganizerFileSyncStatus {
  return f.syncStatus ?? "local";
}

function fileSyncStatusLabel(
  status: OrganizerFileSyncStatus,
  tr: Translations,
): string {
  switch (status) {
    case "uploading":
      return tr.fileSyncUploading;
    case "synced":
      return tr.fileSyncSynced;
    case "error":
      return tr.fileSyncError;
    default:
      return tr.fileSyncLocal;
  }
}

function subjectDotClass(color: string): string {
  const m: Record<string, string> = {
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    cyan: "bg-cyan-500",
    slate: "bg-slate-500",
  };
  return m[color] ?? "bg-slate-400";
}

function isTypingInTextField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const t = (target as HTMLInputElement).type;
    return (
      t === "text" ||
      t === "search" ||
      t === "url" ||
      t === "email" ||
      t === "password" ||
      t === "number" ||
      t === "tel"
    );
  }
  return false;
}

function pastedImageFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `pasted-image-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}.png`;
}

function formatFileCreatedLabel(iso: string | undefined, lang: HubUiLang): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "";
  }
}

function FileImageThumbnail({
  fileId,
  mimeType,
}: {
  fileId: string;
  mimeType: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!mimeType.startsWith("image/")) {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
    void getOrganizerFileBlob(fileId).then((blob) => {
      if (!blob || cancelled || !blob.type.startsWith("image/")) return;
      const url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setSrc(url);
    });
    return () => {
      cancelled = true;
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileId, mimeType]);

  if (!mimeType.startsWith("image/") || !src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
        <FileIcon className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-12 w-12 shrink-0 rounded-xl border border-slate-200/80 object-cover"
    />
  );
}

export function StudyOrganizerPage() {
  const { language } = useHubUiLang();
  const t = translations[language];

  const [state, setState] = useState<OrganizerPersisted>(() =>
    loadOrganizerState(),
  );
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<OrganizerTab>("notes");
  const [search, setSearch] = useState("");
  const [mobileSubjectsOpen, setMobileSubjectsOpen] = useState(false);

  const [subjectModal, setSubjectModal] = useState<
    "add" | { type: "rename"; subject: OrganizerSubject } | null
  >(null);
  const [subjectFormName, setSubjectFormName] = useState("");
  const [subjectFormColor, setSubjectFormColor] = useState<string>("blue");

  const [noteModal, setNoteModal] = useState<OrganizerNote | "new" | null>(
    null,
  );
  const [noteDraft, setNoteDraft] = useState({ title: "", content: "" });

  const [linkModal, setLinkModal] = useState<OrganizerLink | "new" | null>(
    null,
  );
  const [linkDraft, setLinkDraft] = useState({
    title: "",
    url: "",
    description: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesDropZoneRef = useRef<HTMLDivElement>(null);
  const fileDragDepthRef = useRef(0);
  const [fileError, setFileError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [filesDragActive, setFilesDragActive] = useState(false);

  const { user, loading: authLoading, supabaseReady } = useAuth();
  const [myStorageQuota, setMyStorageQuota] = useState<MyStorageQuota | null>(
    null,
  );

  const refreshMyStorageQuota = useCallback(async () => {
    if (!user || !supabaseReady) {
      setMyStorageQuota(null);
      return;
    }
    const q = await fetchMyStorageQuota(user.id);
    setMyStorageQuota(q);
  }, [user, supabaseReady]);

  useEffect(() => {
    void refreshMyStorageQuota();
  }, [refreshMyStorageQuota]);
  const [syncPhase, setSyncPhase] = useState<"syncing" | "synced" | "error">(
    "synced",
  );
  const cloudSyncDisplay = useMemo((): CloudSyncUiStatus => {
    if (!supabaseReady) return "unavailable";
    if (!user) return "local_only";
    return syncPhase;
  }, [supabaseReady, user, syncPhase]);

  const organizerSnapshotRef = useRef<OrganizerPersisted>(state);
  useEffect(() => {
    organizerSnapshotRef.current = state;
  }, [state]);

  const lastOrganizerSyncUserRef = useRef<string | null>(null);
  const [organizerCloudHydrated, setOrganizerCloudHydrated] = useState(false);

  useEffect(() => {
    if (!user) {
      setOrganizerCloudHydrated(false);
      lastOrganizerSyncUserRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    saveOrganizerState(state);
  }, [state]);

  useEffect(() => {
    if (!supabaseReady || authLoading || !user) return;
    if (lastOrganizerSyncUserRef.current === user.id) return;
    lastOrganizerSyncUserRef.current = user.id;
    let cancelled = false;

    void (async () => {
      setSyncPhase("syncing");
      const snap = organizerSnapshotRef.current;
      const { subjects, notes, links, fileRows, deletions, error } =
        await loadOrganizerFromCloud(user);
      if (cancelled) return;
      if (error) {
        setSyncPhase("error");
        setOrganizerCloudHydrated(true);
        return;
      }
      const merged = mergeOrganizerData(
        snap,
        { subjects, notes, links, files: fileRows },
        deletions,
      );
      if (cancelled) return;
      setState(merged);
      const { error: pushErr } = await pushOrganizerToCloud(user, merged);
      if (cancelled) return;
      setOrganizerCloudHydrated(true);
      setSyncPhase(pushErr ? "error" : "synced");
    })();

    return () => {
      cancelled = true;
      lastOrganizerSyncUserRef.current = null;
    };
  }, [user, authLoading, supabaseReady]);

  useEffect(() => {
    if (!supabaseReady || !user || authLoading || !organizerCloudHydrated) {
      return;
    }
    const id = window.setTimeout(() => {
      const snap = organizerSnapshotRef.current;
      setSyncPhase("syncing");
      void pushOrganizerToCloud(user, snap).then(({ error }) => {
        setSyncPhase(error ? "error" : "synced");
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [
    state.subjects,
    state.notes,
    state.links,
    state.files,
    user,
    supabaseReady,
    authLoading,
    organizerCloudHydrated,
  ]);

  const retryOrganizerCloudSync = useCallback(() => {
    if (!user || !supabaseReady) return;
    setSyncPhase("syncing");
    void pushOrganizerToCloud(user, organizerSnapshotRef.current).then(
      ({ error }) => {
        setSyncPhase(error ? "error" : "synced");
      },
    );
  }, [user, supabaseReady]);

  useOnlineSyncRecovery({
    enabled: Boolean(user && supabaseReady && organizerCloudHydrated),
    isError: syncPhase === "error",
    onRetry: retryOrganizerCloudSync,
  });

  useEffect(() => {
    const preventNav = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    window.addEventListener("dragover", preventNav);
    window.addEventListener("drop", preventNav);
    return () => {
      window.removeEventListener("dragover", preventNav);
      window.removeEventListener("drop", preventNav);
    };
  }, []);

  useEffect(() => {
    if (tab !== "files") {
      fileDragDepthRef.current = 0;
      setFilesDragActive(false);
    }
  }, [tab]);

  useEffect(() => {
    if (linkModal) setLinkError("");
  }, [linkModal]);

  useEffect(() => {
    if (
      activeSubjectId &&
      !state.subjects.some((s) => s.id === activeSubjectId)
    ) {
      setActiveSubjectId(state.subjects[0]?.id ?? null);
    }
    if (!activeSubjectId && state.subjects.length > 0) {
      setActiveSubjectId(state.subjects[0].id);
    }
  }, [state.subjects, activeSubjectId]);

  const activeSubject = useMemo(
    () => state.subjects.find((s) => s.id === activeSubjectId) ?? null,
    [state.subjects, activeSubjectId],
  );

  const countsFor = useCallback(
    (subjectId: string) => {
      const notes = state.notes.filter((n) => n.subjectId === subjectId);
      const links = state.links.filter((l) => l.subjectId === subjectId);
      const files = state.files.filter((f) => f.subjectId === subjectId);
      return { notes: notes.length, links: links.length, files: files.length };
    },
    [state],
  );

  const q = search.trim().toLowerCase();

  const filteredNotes = useMemo(() => {
    if (!activeSubjectId) return [];
    let list = state.notes.filter((n) => n.subjectId === activeSubjectId);
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [state.notes, activeSubjectId, q]);

  const filteredLinks = useMemo(() => {
    if (!activeSubjectId) return [];
    let list = state.links.filter((l) => l.subjectId === activeSubjectId);
    if (q) {
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          (l.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [state.links, activeSubjectId, q]);

  const filteredFiles = useMemo(() => {
    if (!activeSubjectId) return [];
    let list = state.files.filter((f) => f.subjectId === activeSubjectId);
    if (q) {
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [state.files, activeSubjectId, q]);

  const ingestFilesFromList = useCallback(
    async (fileArray: File[]) => {
      if (!activeSubjectId || fileArray.length === 0) return;
      setFileError("");
      let hadUnsupported = false;
      let hadTooLarge = false;
      for (const file of fileArray) {
        if (!isOrganizerAcceptedFile(file)) {
          hadUnsupported = true;
          continue;
        }
        if (file.size > ORGANIZER_MAX_FILE_BYTES) {
          hadTooLarge = true;
          continue;
        }
        const id = newOrganizerId();
        try {
          await saveOrganizerFileBlob(id, file);
          const createdAt = new Date().toISOString();
          setState((prev) => ({
            ...prev,
            files: [
              ...prev.files,
              {
                id,
                subjectId: activeSubjectId,
                name: file.name,
                size: file.size,
                type: file.type || "application/octet-stream",
                createdAt,
                syncStatus: "local",
              },
            ],
          }));
        } catch {
          setFileError(t.fileUnavailable);
        }
      }
      if (hadUnsupported) setFileError(t.unsupportedFileType);
      else if (hadTooLarge) setFileError(t.fileTooLarge);
    },
    [activeSubjectId, t],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (noteModal || linkModal || subjectModal) return;
      if (tab !== "files") return;
      if (!activeSubjectId) return;
      if (isTypingInTextField(e.target)) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const incoming: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const rawName = blob.name?.trim() ?? "";
        const name =
          rawName &&
          !/^image\.png$/i.test(rawName) &&
          rawName.toLowerCase() !== "unnamed"
            ? rawName
            : pastedImageFileName();
        incoming.push(
          new File([blob], name, { type: blob.type || "image/png" }),
        );
      }
      if (!incoming.length) return;
      e.preventDefault();
      void ingestFilesFromList(incoming);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [
    noteModal,
    linkModal,
    subjectModal,
    tab,
    activeSubjectId,
    ingestFilesFromList,
  ]);

  const handleFilesDragEnter = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes("Files")) return;
    fileDragDepthRef.current += 1;
    setFilesDragActive(true);
  }, []);

  const handleFilesDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fileDragDepthRef.current -= 1;
    if (fileDragDepthRef.current <= 0) {
      fileDragDepthRef.current = 0;
      setFilesDragActive(false);
    }
  }, []);

  const handleFilesDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleFilesDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      fileDragDepthRef.current = 0;
      setFilesDragActive(false);
      const dt = e.dataTransfer.files;
      if (dt?.length) void ingestFilesFromList(Array.from(dt));
    },
    [ingestFilesFromList],
  );

  function addSubject() {
    const name = subjectFormName.trim();
    if (!name) return;
    const id = newOrganizerId();
    setState((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          id,
          name,
          color: subjectFormColor,
          clientUpdatedAt: new Date().toISOString(),
        },
      ],
    }));
    setActiveSubjectId(id);
    setSubjectModal(null);
    setSubjectFormName("");
    setSubjectFormColor("blue");
  }

  function renameSubject() {
    if (
      !subjectModal ||
      subjectModal === "add" ||
      subjectModal.type !== "rename"
    ) {
      return;
    }
    const name = subjectFormName.trim();
    if (!name) return;
    const id = subjectModal.subject.id;
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === id
          ? {
              ...s,
              name,
              color: subjectFormColor,
              clientUpdatedAt: new Date().toISOString(),
            }
          : s,
      ),
    }));
    setSubjectModal(null);
  }

  function deleteSubject(subject: OrganizerSubject) {
    if (!window.confirm(t.confirmDeleteSubject)) return;
    const id = subject.id;
    addOrganizerSubjectTombstone(id);
    const toRemove = organizerSnapshotRef.current.files.filter(
      (f) => f.subjectId === id,
    );
    for (const f of toRemove) {
      addOrganizerFileTombstone(f.id);
      if (
        user &&
        f.storagePath &&
        effectiveFileSyncStatus(f) === "synced"
      ) {
        void deleteOrganizerFileFromCloud(user, f.id, f.storagePath);
      }
      void deleteOrganizerFileBlob(f.id);
    }
    setState((prev) => ({
      subjects: prev.subjects.filter((s) => s.id !== id),
      notes: prev.notes.filter((n) => n.subjectId !== id),
      links: prev.links.filter((l) => l.subjectId !== id),
      files: prev.files.filter((f) => f.subjectId !== id),
    }));
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
    }
    if (user) {
      void refreshMyStorageQuota();
    }
  }

  function saveNote() {
    if (!activeSubjectId) return;
    if (noteModal === "new") {
      const title = noteDraft.title.trim() || t.noteTitle;
      const id = newOrganizerId();
      setState((prev) => ({
        ...prev,
        notes: [
          ...prev.notes,
          {
            id,
            subjectId: activeSubjectId,
            title,
            content: noteDraft.content,
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
    } else if (noteModal) {
      const id = noteModal.id;
      setState((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id
            ? {
                ...n,
                title: noteDraft.title.trim() || t.noteTitle,
                content: noteDraft.content,
                updatedAt: new Date().toISOString(),
              }
            : n,
        ),
      }));
    }
    setNoteModal(null);
  }

  function deleteNote(note: OrganizerNote) {
    if (!window.confirm(t.confirmDeleteNote)) return;
    addOrganizerNoteTombstone(note.id);
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== note.id),
    }));
    setNoteModal(null);
  }

  function togglePin(note: OrganizerNote) {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === note.id
          ? { ...n, pinned: !n.pinned, updatedAt: now }
          : n,
      ),
    }));
  }

  function saveLink() {
    if (!activeSubjectId) return;
    const title = linkDraft.title.trim();
    const url = linkDraft.url.trim();
    if (!title) return;
    if (!isValidHttpUrl(url)) {
      setLinkError(t.invalidUrl);
      return;
    }
    setLinkError("");
    if (linkModal === "new") {
      setState((prev) => ({
        ...prev,
        links: [
          ...prev.links,
          {
            id: newOrganizerId(),
            subjectId: activeSubjectId,
            title,
            url,
            description: linkDraft.description.trim() || undefined,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      }));
    } else if (linkModal) {
      const id = linkModal.id;
      setState((prev) => ({
        ...prev,
        links: prev.links.map((l) =>
          l.id === id
            ? {
                ...l,
                title,
                url,
                description: linkDraft.description.trim() || undefined,
                clientUpdatedAt: new Date().toISOString(),
              }
            : l,
        ),
      }));
    }
    setLinkModal(null);
  }

  function deleteLink(link: OrganizerLink) {
    if (!window.confirm(t.confirmDeleteLink)) return;
    addOrganizerLinkTombstone(link.id);
    setState((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l.id !== link.id),
    }));
    setLinkModal(null);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    await ingestFilesFromList(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const syncFileToCloud = useCallback(
    async (entry: OrganizerFileEntry) => {
      if (!user || !supabaseReady) return;
      const typeProbe = new File([], entry.name, { type: entry.type });
      if (!isOrganizerAcceptedFile(typeProbe)) {
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  syncStatus: "error",
                  syncError: t.unsupportedFileType,
                }
              : f,
          ),
        }));
        return;
      }
      if (entry.size > ORGANIZER_MAX_FILE_BYTES) {
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === entry.id
              ? { ...f, syncStatus: "error", syncError: t.fileTooLarge }
              : f,
          ),
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === entry.id
            ? { ...f, syncStatus: "uploading", syncError: undefined }
            : f,
        ),
      }));
      const blob = await getOrganizerFileBlob(entry.id);
      if (!blob) {
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  syncStatus: "error",
                  syncError: t.fileUnavailable,
                }
              : f,
          ),
        }));
        return;
      }
      const result = await uploadOrganizerFileToCloud(user, entry, blob);
      if (result.error || !result.storagePath) {
        const quotaHit = result.code === STORAGE_QUOTA_EXCEEDED_CODE;
        const tooLarge =
          result.code === ORGANIZER_SYNC_FILE_TOO_LARGE_CODE;
        const syncErrMsg = quotaHit
          ? t.fileSyncQuotaExceeded
          : tooLarge
            ? t.fileTooLarge
            : t.fileSyncGenericFailed;
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  syncStatus: "error",
                  syncError: syncErrMsg,
                }
              : f,
          ),
        }));
        return;
      }
      const syncedAt = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === entry.id
            ? {
                ...f,
                syncStatus: "synced",
                storagePath: result.storagePath,
                syncedAt,
                syncError: undefined,
              }
            : f,
        ),
      }));
      void refreshMyStorageQuota();
    },
    [user, supabaseReady, t, refreshMyStorageQuota],
  );

  async function downloadFile(entry: OrganizerFileEntry) {
    let blob = await getOrganizerFileBlob(entry.id);
    if (!blob && user && supabaseReady && entry.storagePath) {
      const { blob: cloudBlob, error } = await downloadOrganizerFileFromCloud(
        entry.storagePath,
      );
      if (error || !cloudBlob) {
        setFileError(t.fileUnavailable);
        return;
      }
      try {
        await saveOrganizerFileBlob(entry.id, cloudBlob);
      } catch {
        setFileError(t.fileUnavailable);
        return;
      }
      blob = cloudBlob;
    }
    if (!blob) {
      setFileError(t.fileUnavailable);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeFile(entry: OrganizerFileEntry) {
    if (!window.confirm(t.confirmDeleteFile)) return;
    addOrganizerFileTombstone(entry.id);
    if (
      user &&
      entry.storagePath &&
      effectiveFileSyncStatus(entry) === "synced"
    ) {
      await deleteOrganizerFileFromCloud(user, entry.id, entry.storagePath);
      void refreshMyStorageQuota();
    }
    void deleteOrganizerFileBlob(entry.id);
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== entry.id),
    }));
  }

  function openNewNote() {
    setNoteDraft({ title: "", content: "" });
    setNoteModal("new");
  }

  function openEditNote(note: OrganizerNote) {
    setNoteDraft({ title: note.title, content: note.content });
    setNoteModal(note);
  }

  function openNewLink() {
    setLinkDraft({ title: "", url: "", description: "" });
    setLinkError("");
    setLinkModal("new");
  }

  function openEditLink(link: OrganizerLink) {
    setLinkDraft({
      title: link.title,
      url: link.url,
      description: link.description ?? "",
    });
    setLinkError("");
    setLinkModal(link);
  }

  async function copyNoteContent(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const subjectSidebar = (
    <aside
      className={`flex w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:w-64 ${
        mobileSubjectsOpen ? "block" : "hidden"
      } lg:flex`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t.subjects}
        </h2>
        <button
          type="button"
          onClick={() => {
            setSubjectFormName("");
            setSubjectFormColor("blue");
            setSubjectModal("add");
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          {t.add}
        </button>
      </div>
      <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto lg:max-h-none">
        {state.subjects.map((s) => {
          const c = countsFor(s.id);
          const active = s.id === activeSubjectId;
          return (
            <li key={s.id}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
                  active
                    ? "border-blue-200 bg-blue-50/80"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubjectId(s.id);
                    setMobileSubjectsOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${subjectDotClass(s.color)}`}
                  />
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {s.name}
                  </span>
                </button>
                <SubjectMenu
                  onRename={() => {
                    setSubjectFormName(s.name);
                    setSubjectFormColor(s.color);
                    setSubjectModal({ type: "rename", subject: s });
                  }}
                  onDelete={() => deleteSubject(s)}
                  t={t}
                />
              </div>
              <p className="ml-6 mt-0.5 text-[11px] text-slate-500">
                {t.countsSummary
                  .replace("{notes}", String(c.notes))
                  .replace("{links}", String(c.links))
                  .replace("{files}", String(c.files))}
              </p>
            </li>
          );
        })}
      </ul>
    </aside>
  );

  const hasSearchNoResults =
    q &&
    ((tab === "notes" && filteredNotes.length === 0) ||
      (tab === "links" && filteredLinks.length === 0) ||
      (tab === "files" && filteredFiles.length === 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            {t.backToHub}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-soft">
                <LayoutGrid className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="hidden font-semibold tracking-tight sm:inline">
                {t.pageTitle}
              </span>
            </div>
            <div className="hidden sm:block">
              <CloudSyncBadge
                status={cloudSyncDisplay}
                lang={language}
                localOnlyLabel={t.cloudSyncLocalOnlyHint}
              />
            </div>
            <HubAuthNav lang={language} compact />
            <HubLanguageToggle />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2 sm:hidden sm:px-6">
          <CloudSyncBadge
            status={cloudSyncDisplay}
            lang={language}
            localOnlyLabel={t.cloudSyncLocalOnlyHint}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t.pageSubtitle}</p>
        </div>

        {state.subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-100">
            <BookOpen className="mx-auto h-10 w-10 text-slate-400" strokeWidth={1.5} />
            <p className="mt-4 text-sm font-medium text-slate-600">
              {t.emptySubjects}
            </p>
            <button
              type="button"
              onClick={() => {
                setSubjectFormName("");
                setSubjectFormColor("blue");
                setSubjectModal("add");
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {t.addSubject}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
              onClick={() => setMobileSubjectsOpen((v) => !v)}
            >
              <BookOpen className="h-4 w-4" />
              {t.subjectsToggle}
            </button>
            {subjectSidebar}
            <section className="min-w-0 flex-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
              {activeSubject ? (
                <>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${subjectDotClass(activeSubject.color)}`}
                      />
                      <h2 className="text-lg font-bold text-slate-900">
                        {activeSubject.name}
                      </h2>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none ring-blue-500/30 focus:ring-2 sm:w-72"
                      />
                    </div>
                  </div>

                  <div className="mb-6 inline-flex rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
                    {(
                      [
                        ["notes", t.notes, StickyNote],
                        ["links", t.links, Link2],
                        ["files", t.files, FileIcon],
                      ] as const
                    ).map(([k, label, Icon]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTab(k)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                          tab === k
                            ? "bg-white text-blue-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {fileError ? (
                    <p className="mb-3 text-sm text-red-600">{fileError}</p>
                  ) : null}
                  {linkError && linkModal ? (
                    <p className="mb-3 text-sm text-red-600">{linkError}</p>
                  ) : null}

                  {hasSearchNoResults ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      {t.noSearchResults}
                    </p>
                  ) : null}

                  {tab === "notes" && !hasSearchNoResults && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={openNewNote}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2} />
                          {t.newNote}
                        </button>
                      </div>
                      {filteredNotes.length === 0 && !q ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                          {t.emptyNotes}
                        </p>
                      ) : (
                        filteredNotes.map((note) => (
                          <article
                            key={note.id}
                            className="rounded-2xl border border-slate-200/80 bg-slate-50/30 p-4 ring-1 ring-slate-100"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {note.pinned ? (
                                    <Pin className="h-4 w-4 shrink-0 text-amber-500" />
                                  ) : null}
                                  <h3 className="font-semibold text-slate-900">
                                    {note.title}
                                  </h3>
                                </div>
                                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
                                  {note.content || "—"}
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                  {t.lastEdited}{" "}
                                  {new Date(note.updatedAt).toLocaleString(
                                    language === "zh" ? "zh-CN" : "en-US",
                                  )}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => togglePin(note)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/80"
                                  title={note.pinned ? t.unpin : t.pin}
                                >
                                  <Pin className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyNoteContent(
                                      `${note.title}\n\n${note.content}`,
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/80"
                                  title={t.copyNote}
                                >
                                  <Copy className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditNote(note)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/80"
                                >
                                  <Pencil className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteNote(note)}
                                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  )}

                  {tab === "links" && !hasSearchNoResults && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={openNewLink}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2} />
                          {t.addLink}
                        </button>
                      </div>
                      {filteredLinks.length === 0 && !q ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                          {t.emptyLinks}
                        </p>
                      ) : (
                        filteredLinks.map((link) => (
                          <div
                            key={link.id}
                            className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {link.title}
                              </p>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 break-all text-sm text-blue-600 hover:underline"
                              >
                                {link.url}
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              </a>
                              {link.description ? (
                                <p className="mt-2 text-sm text-slate-500">
                                  {link.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t.openLink}
                              </a>
                              <button
                                type="button"
                                onClick={() => openEditLink(link)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLink(link)}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {tab === "files" && !hasSearchNoResults && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">{t.fileStorageHint}</p>
                      <p className="text-xs text-slate-400">{t.fileLocalFirstHint}</p>
                      {user && supabaseReady && myStorageQuota ? (
                        <p
                          className={`text-xs ${
                            storageUsageRatio(
                              myStorageQuota.usedBytes,
                              myStorageQuota.maxBytes,
                            ) >= 0.95
                              ? "font-medium text-red-600"
                              : storageUsageRatio(
                                    myStorageQuota.usedBytes,
                                    myStorageQuota.maxBytes,
                                  ) >= 0.8
                                ? "font-medium text-amber-700"
                                : "text-slate-500"
                          }`}
                        >
                          {t.storageUsedLine
                            .replace(
                              "{used}",
                              formatStorageMb(myStorageQuota.usedBytes),
                            )
                            .replace(
                              "{max}",
                              formatStorageMb(myStorageQuota.maxBytes),
                            )}
                        </p>
                      ) : null}
                      <div
                        ref={filesDropZoneRef}
                        role="region"
                        tabIndex={0}
                        aria-label={`${t.files}: ${t.dropZoneLine1}`}
                        onDragEnter={handleFilesDragEnter}
                        onDragLeave={handleFilesDragLeave}
                        onDragOver={handleFilesDragOver}
                        onDrop={handleFilesDrop}
                        className={`rounded-2xl border-2 border-dashed p-4 shadow-sm ring-1 ring-slate-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                          filesDragActive
                            ? "border-blue-500 bg-blue-50/90 ring-blue-200"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          multiple
                          accept={ORGANIZER_FILE_INPUT_ACCEPT}
                          onChange={(e) => void onPickFiles(e.target.files)}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-center sm:text-left">
                            <p className="text-sm font-semibold text-slate-800">
                              {t.dropZoneLine1}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t.dropZoneLine2}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            {t.addFile}
                          </button>
                        </div>
                        {fileError ? (
                          <p className="mt-3 text-sm text-red-600">{fileError}</p>
                        ) : null}
                        {filteredFiles.length === 0 && !q ? (
                          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                            {t.emptyFiles}
                          </p>
                        ) : filteredFiles.length > 0 ? (
                          <ul className="mt-4 space-y-2">
                            {filteredFiles.map((f) => {
                              const syncSt = effectiveFileSyncStatus(f);
                              const canCloudSync = Boolean(
                                user && supabaseReady,
                              );
                              const showSyncAction =
                                syncSt === "local" ||
                                syncSt === "error";
                              const syncLabel =
                                syncSt === "error"
                                  ? t.fileRetryAction
                                  : t.fileSyncAction;
                              const badgeClass =
                                syncSt === "synced"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : syncSt === "uploading"
                                    ? "border-blue-200 bg-blue-50 text-blue-800"
                                    : syncSt === "error"
                                      ? "border-red-200 bg-red-50 text-red-800"
                                      : "border-slate-200 bg-white text-slate-600";
                              return (
                                <li
                                  key={f.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-3"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <FileImageThumbnail
                                      fileId={f.id}
                                      mimeType={f.type}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate font-medium text-slate-900">
                                          {f.name}
                                        </p>
                                        <span
                                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                                        >
                                          {syncSt === "uploading" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : null}
                                          {fileSyncStatusLabel(syncSt, t)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500">
                                        {f.type || "—"} ·{" "}
                                        {formatFileSize(f.size)}
                                        {f.createdAt
                                          ? ` · ${t.fileAddedAt} ${formatFileCreatedLabel(f.createdAt, language)}`
                                          : ""}
                                      </p>
                                      {syncSt === "error" && f.syncError ? (
                                        <p className="mt-1 text-xs text-red-600">
                                          {f.syncError}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {showSyncAction ? (
                                      <button
                                        type="button"
                                        disabled={!canCloudSync}
                                        title={
                                          !canCloudSync
                                            ? t.fileSyncNeedLogin
                                            : undefined
                                        }
                                        onClick={() => void syncFileToCloud(f)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <CloudUpload className="h-3.5 w-3.5" />
                                        {syncLabel}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => void downloadFile(f)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      {t.download}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void removeFile(f)}
                                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      {t.removeFile}
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>
          </div>
        )}
      </main>

      {(subjectModal === "add" ||
        (subjectModal && subjectModal.type === "rename")) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {subjectModal === "add" ? t.addSubject : t.rename}
            </h3>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
              {t.subjectName}
            </label>
            <input
              value={subjectFormName}
              onChange={(e) => setSubjectFormName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring-2"
              autoFocus
            />
            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">
              {t.color}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBJECT_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSubjectFormColor(c)}
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${
                    subjectFormColor === c
                      ? "ring-blue-500"
                      : "ring-transparent"
                  } ${subjectDotClass(c)}`}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubjectModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={
                  subjectModal === "add" ? addSubject : renameSubject
                }
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-bold text-slate-900">
                {noteModal === "new" ? t.newNote : t.edit}
              </h3>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                {t.noteTitle}
              </label>
              <input
                value={noteDraft.title}
                onChange={(e) =>
                  setNoteDraft((d) => ({ ...d, title: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
                {t.noteContent}
              </label>
              <textarea
                value={noteDraft.content}
                onChange={(e) =>
                  setNoteDraft((d) => ({ ...d, content: e.target.value }))
                }
                rows={10}
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 px-4 py-3">
              {noteModal !== "new" && noteModal ? (
                <button
                  type="button"
                  onClick={() => deleteNote(noteModal)}
                  className="text-sm font-semibold text-red-600 hover:underline"
                >
                  {t.delete}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={saveNote}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {linkModal === "new" ? t.addLink : t.edit}
            </h3>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
              {t.linkTitle}
            </label>
            <input
              value={linkDraft.title}
              onChange={(e) =>
                setLinkDraft((d) => ({ ...d, title: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
              {t.url}
            </label>
            <input
              value={linkDraft.url}
              onChange={(e) =>
                setLinkDraft((d) => ({ ...d, url: e.target.value }))
              }
              placeholder="https://"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
              {t.description} ({t.optional})
            </label>
            <textarea
              value={linkDraft.description}
              onChange={(e) =>
                setLinkDraft((d) => ({ ...d, description: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-6 flex justify-between gap-2">
              {linkModal !== "new" && linkModal ? (
                <button
                  type="button"
                  onClick={() => deleteLink(linkModal)}
                  className="text-sm font-semibold text-red-600"
                >
                  {t.delete}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLinkModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkError("");
                    if (!isValidHttpUrl(linkDraft.url.trim())) {
                      setLinkError(t.invalidUrl);
                      return;
                    }
                    saveLink();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectMenu({
  onRename,
  onDelete,
  t,
}: {
  onRename: () => void;
  onDelete: () => void;
  t: Translations;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1 text-slate-500 hover:bg-slate-200/80"
        aria-label="Menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[8rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            {t.rename}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {t.delete}
          </button>
        </div>
      ) : null}
    </div>
  );
}
