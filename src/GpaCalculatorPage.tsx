import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Link } from "react-router-dom";
import { HubAuthNav } from "./components/HubAuthNav";
import {
  ArrowLeft,
  Calculator,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

// —— Types & constants ——————————————————————————————————————————

export type CourseLevel = "regular" | "honors" | "ap" | "ib";

export type Course = {
  id: string;
  name: string;
  gradeKey: string;
  credits: number;
  level: CourseLevel;
  excluded: boolean;
};

type GpaLang = "en" | "zh";

type GpaTranslations = {
  lang: { en: string; zh: string };
  backToHub: string;
  gpaCalculator: string;
  introTitle: string;
  introBody: string;
  statUnweighted: string;
  statUnweightedSub: string;
  statWeighted: string;
  statWeightedSub: string;
  statTotalCredits: string;
  statTotalCreditsSub: string;
  statQuality: string;
  statQualitySub: string;
  sectionCourses: string;
  addCourse: string;
  courseName: string;
  courseNamePlaceholder: string;
  grade: string;
  gradePtsSuffix: (pts: string) => string;
  credits: string;
  level: string;
  levelWeightedSuffix: (n: string) => string;
  levels: Record<CourseLevel, string>;
  exclude: string;
  remove: string;
  customScaleTitle: string;
  customScaleSubtitle: string;
  resetScale: string;
  disclaimerLabel: string;
  disclaimerBody: string;
  emptyGpa: string;
  resetSavedData: string;
  copySummary: string;
  downloadSummaryTxt: string;
  downloadDataJson: string;
  copied: string;
  copyFailed: string;
  exportExcludeYes: string;
  exportExcludeNo: string;
  exportMetaLanguage: string;
  exportCourseStatus: string;
  downloadPdf: string;
  loadDemoData: string;
  demoLoaded: string;
};

/** Labels used only inside the PDF (match product copy for reports). */
type GpaPdfLabels = {
  reportTitle: string;
  unweighted: string;
  weighted: string;
  totalCredits: string;
  qualityPoints: string;
  courseList: string;
  courseName: string;
  grade: string;
  credits: string;
  level: string;
  status: string;
  excluded: string;
  included: string;
  exportedAt: string;
};

const pdfLabels: Record<GpaLang, GpaPdfLabels> = {
  en: {
    reportTitle: "GPA Calculator Report",
    unweighted: "Unweighted GPA",
    weighted: "Weighted GPA",
    totalCredits: "Total Credits",
    qualityPoints: "Quality Points",
    courseList: "Course List",
    courseName: "Course Name",
    grade: "Grade",
    credits: "Credits",
    level: "Level",
    status: "Status",
    excluded: "Excluded",
    included: "Included",
    exportedAt: "Exported at",
  },
  zh: {
    reportTitle: "GPA 计算报告",
    unweighted: "未加权 GPA",
    weighted: "加权 GPA",
    totalCredits: "总学分",
    qualityPoints: "质量分",
    courseList: "课程列表",
    courseName: "课程名称",
    grade: "成绩",
    credits: "学分",
    level: "课程等级",
    status: "状态",
    excluded: "已排除",
    included: "计入",
    exportedAt: "导出时间",
  },
};

const translations: Record<GpaLang, GpaTranslations> = {
  en: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "Back to hub",
    gpaCalculator: "GPA Calculator",
    introTitle: "GPA Calculator",
    introBody:
      "Unweighted GPA uses your letter grades only. Weighted GPA adds honors / AP / IB bumps on top of the same scale—adjust the custom scale to match your school.",
    statUnweighted: "Unweighted GPA",
    statUnweightedSub: "Letter points only",
    statWeighted: "Weighted GPA",
    statWeightedSub: "Includes level weighting",
    statTotalCredits: "Total Credits",
    statTotalCreditsSub: "Included in GPA",
    statQuality: "Quality Points",
    statQualitySub: "Unweighted / weighted Σ(pts×cr)",
    sectionCourses: "Courses",
    addCourse: "Add course",
    courseName: "Course name",
    courseNamePlaceholder: "e.g. AP Calculus BC",
    grade: "Grade",
    gradePtsSuffix: (pts) => `${pts} pts`,
    credits: "Credits",
    level: "Level",
    levelWeightedSuffix: (n) => ` (+${n} weighted)`,
    levels: {
      regular: "Regular",
      honors: "Honors",
      ap: "AP",
      ib: "IB",
    },
    exclude: "Exclude",
    remove: "Delete",
    customScaleTitle: "Custom Scale",
    customScaleSubtitle:
      "Edit grade point values to match your transcript policy.",
    resetScale: "Reset to default scale",
    disclaimerLabel: "Disclaimer:",
    disclaimerBody:
      "GPA policies vary by school. This calculator uses a common 4.0 scale by default and may differ from your school’s official method.",
    emptyGpa: "—",
    resetSavedData: "Reset saved data",
    copySummary: "Copy summary",
    downloadSummaryTxt: "Download Summary (.txt)",
    downloadDataJson: "Download Data (.json)",
    copied: "Copied to clipboard.",
    copyFailed: "Could not copy.",
    exportExcludeYes: "Excluded",
    exportExcludeNo: "Included",
    exportMetaLanguage: "Language",
    exportCourseStatus: "Status",
    downloadPdf: "Download PDF",
    loadDemoData: "Load Demo Data",
    demoLoaded: "Demo courses loaded.",
  },
  zh: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "返回首页",
    gpaCalculator: "GPA 计算器",
    introTitle: "GPA 计算器",
    introBody:
      "未加权 GPA 仅使用字母课程成绩。加权 GPA 在相同绩点表上叠加荣誉 / AP / IB 等课程等级加分——您也可通过自定义绩点表对齐本校规则。",
    statUnweighted: "未加权 GPA",
    statUnweightedSub: "仅按字母绩点",
    statWeighted: "加权 GPA",
    statWeightedSub: "含课程等级加权",
    statTotalCredits: "总学分",
    statTotalCreditsSub: "计入 GPA",
    statQuality: "质量分",
    statQualitySub: "未加权 / 加权 Σ(绩点×学分)",
    sectionCourses: "课程",
    addCourse: "添加课程",
    courseName: "课程名称",
    courseNamePlaceholder: "例如：AP 微积分 BC",
    grade: "成绩",
    gradePtsSuffix: (pts) => `${pts} 分`,
    credits: "学分",
    level: "课程等级",
    levelWeightedSuffix: (n) => `（加权 +${n}）`,
    levels: {
      regular: "普通",
      honors: "荣誉",
      ap: "AP",
      ib: "IB",
    },
    exclude: "排除",
    remove: "删除",
    customScaleTitle: "自定义绩点表",
    customScaleSubtitle: "按本校成绩单政策编辑各档成绩对应的绩点。",
    resetScale: "恢复默认绩点表",
    disclaimerLabel: "免责声明：",
    disclaimerBody:
      "不同学校的 GPA 规则可能不同。本计算器默认采用常见的 4.0 绩点制，结果可能与您学校的官方计算方式不同。",
    emptyGpa: "—",
    resetSavedData: "清除已保存数据",
    copySummary: "复制摘要",
    downloadSummaryTxt: "下载摘要",
    downloadDataJson: "下载数据",
    copied: "已复制到剪贴板。",
    copyFailed: "复制失败。",
    exportExcludeYes: "已排除",
    exportExcludeNo: "计入",
    exportMetaLanguage: "语言",
    exportCourseStatus: "状态",
    downloadPdf: "下载 PDF",
    loadDemoData: "加载示例数据",
    demoLoaded: "已加载示例课程。",
  },
};

/** Default 4.0 scale with +/- (product default). */
export const DEFAULT_GRADE_SCALE: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.67,
  "B+": 3.33,
  B: 3.0,
  "B-": 2.67,
  "C+": 2.33,
  C: 2.0,
  "C-": 1.67,
  D: 1.0,
  F: 0.0,
};

export const GRADE_LETTERS = Object.keys(DEFAULT_GRADE_SCALE);

export const LEVEL_WEIGHTS: Record<CourseLevel, number> = {
  regular: 0,
  honors: 0.5,
  ap: 1.0,
  ib: 1.0,
};

const LEVEL_ORDER: CourseLevel[] = ["regular", "honors", "ap", "ib"];

function newCourseId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyCourse(): Course {
  return {
    id: newCourseId(),
    name: "",
    gradeKey: "A",
    credits: 1,
    level: "regular",
    excluded: false,
  };
}

/** Realistic sample courses for international-school style demos (does not alter scale or language). */
export function getDemoCourses(): Course[] {
  return [
    {
      id: newCourseId(),
      name: "English Literature",
      gradeKey: "A-",
      credits: 1,
      level: "honors",
      excluded: false,
    },
    {
      id: newCourseId(),
      name: "Mathematics AA HL",
      gradeKey: "B+",
      credits: 1,
      level: "ib",
      excluded: false,
    },
    {
      id: newCourseId(),
      name: "Biology",
      gradeKey: "B",
      credits: 1,
      level: "regular",
      excluded: false,
    },
    {
      id: newCourseId(),
      name: "AP Computer Science",
      gradeKey: "A",
      credits: 1,
      level: "ap",
      excluded: false,
    },
    {
      id: newCourseId(),
      name: "Economics",
      gradeKey: "B-",
      credits: 1,
      level: "regular",
      excluded: false,
    },
    {
      id: newCourseId(),
      name: "TOK / Advisory",
      gradeKey: "A",
      credits: 0.5,
      level: "regular",
      excluded: true,
    },
  ];
}

// —— localStorage persistence ——————————————————————————————————

export const GPA_CALCULATOR_STORAGE_KEY = "student-tools-gpa-calculator";

export type PersistedGpaCalculatorState = {
  courses: Course[];
  customScale: Record<string, number>;
  isCustomScaleOpen: boolean;
  language: GpaLang;
};

export function getDefaultCalculatorState(): PersistedGpaCalculatorState {
  return {
    courses: [
      createEmptyCourse(),
      createEmptyCourse(),
      createEmptyCourse(),
    ],
    customScale: { ...DEFAULT_GRADE_SCALE },
    isCustomScaleOpen: true,
    language: "en",
  };
}

function isCourseLevel(x: unknown): x is CourseLevel {
  return x === "regular" || x === "honors" || x === "ap" || x === "ib";
}

function parseCourse(raw: unknown): Course | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.length > 0 ? o.id : newCourseId();
  const name = typeof o.name === "string" ? o.name : "";
  const gradeKey = typeof o.gradeKey === "string" ? o.gradeKey : "A";
  const creditsRaw = o.credits;
  const credits =
    typeof creditsRaw === "number" && Number.isFinite(creditsRaw)
      ? Math.max(0, creditsRaw)
      : 1;
  const level = isCourseLevel(o.level) ? o.level : "regular";
  const excluded =
    typeof o.excluded === "boolean" ? o.excluded : false;
  return { id, name, gradeKey, credits, level, excluded };
}

function normalizeCourses(raw: unknown): Course[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseCourse).filter((c): c is Course => c !== null);
}

function mergeSavedScale(raw: unknown): Record<string, number> {
  const out = { ...DEFAULT_GRADE_SCALE };
  if (!raw || typeof raw !== "object") return out;
  const s = raw as Record<string, unknown>;
  for (const letter of GRADE_LETTERS) {
    if (Object.prototype.hasOwnProperty.call(s, letter)) {
      const v = s[letter];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[letter] = v;
      }
    }
  }
  return out;
}

function parseLanguage(raw: unknown): GpaLang {
  if (raw === "en" || raw === "zh") return raw;
  return "en";
}

/**
 * Returns validated persisted state, or `null` if nothing usable was stored.
 */
export function loadSavedCalculatorState(): PersistedGpaCalculatorState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GPA_CALCULATOR_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const def = getDefaultCalculatorState();

    const language = parseLanguage(o.language);
    const isCustomScaleOpen =
      typeof o.isCustomScaleOpen === "boolean"
        ? o.isCustomScaleOpen
        : def.isCustomScaleOpen;

    let courses = normalizeCourses(o.courses);
    if (courses.length === 0) {
      courses = def.courses;
    }

    const customScale = mergeSavedScale(o.customScale);

    return {
      courses,
      customScale,
      isCustomScaleOpen,
      language,
    };
  } catch {
    return null;
  }
}

export function saveCalculatorState(state: PersistedGpaCalculatorState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedGpaCalculatorState = {
      courses: state.courses,
      customScale: state.customScale,
      isCustomScaleOpen: state.isCustomScaleOpen,
      language: state.language,
    };
    localStorage.setItem(
      GPA_CALCULATOR_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export type GpaTotals = {
  unweightedGpa: number;
  weightedGpa: number;
  totalCredits: number;
  unweightedQualityPoints: number;
  weightedQualityPoints: number;
  countedCourses: number;
};

/**
 * GPA = sum(gradePoints × credits) / sum(credits)
 * Unweighted: letter points only. Weighted: letter points + level bump per course.
 */
export function computeGpaTotals(
  courses: Course[],
  gradeScale: Record<string, number>,
  levelWeights: Record<CourseLevel, number>,
): GpaTotals {
  let uNum = 0;
  let wNum = 0;
  let denom = 0;
  let counted = 0;

  for (const c of courses) {
    if (c.excluded) continue;
    const cred = Number(c.credits);
    if (!Number.isFinite(cred) || cred <= 0) continue;

    const base = gradeScale[c.gradeKey];
    const points =
      typeof base === "number" && Number.isFinite(base) ? base : 0;
    const bump = levelWeights[c.level] ?? 0;

    uNum += points * cred;
    wNum += (points + bump) * cred;
    denom += cred;
    counted += 1;
  }

  if (denom <= 0) {
    return {
      unweightedGpa: 0,
      weightedGpa: 0,
      totalCredits: 0,
      unweightedQualityPoints: 0,
      weightedQualityPoints: 0,
      countedCourses: 0,
    };
  }

  return {
    unweightedGpa: uNum / denom,
    weightedGpa: wNum / denom,
    totalCredits: denom,
    unweightedQualityPoints: uNum,
    weightedQualityPoints: wNum,
    countedCourses: counted,
  };
}

function formatGpa(n: number, empty: string): string {
  if (!Number.isFinite(n)) return empty;
  return n.toFixed(3);
}

function formatCreditsDisplay(totalCredits: number): string {
  if (totalCredits === 0) return "0";
  return totalCredits % 1 === 0
    ? String(totalCredits)
    : totalCredits.toFixed(2);
}

/** Single course credit cell — same rules as total credits formatting. */
function formatCourseCreditsCell(credits: number): string {
  if (!Number.isFinite(credits) || credits < 0) return "0";
  if (credits === 0) return "0";
  return credits % 1 === 0 ? String(credits) : credits.toFixed(2);
}

function formatQualityDisplay(totals: GpaTotals, t: GpaTranslations): string {
  if (totals.countedCourses === 0) return t.emptyGpa;
  return `${totals.unweightedQualityPoints.toFixed(2)} / ${totals.weightedQualityPoints.toFixed(2)}`;
}

function formatGpaStat(totals: GpaTotals, value: number, t: GpaTranslations): string {
  if (totals.countedCourses === 0) return t.emptyGpa;
  return formatGpa(value, t.emptyGpa);
}

/** Plain-text export (same structure used for clipboard). */
export function buildGpaSummaryText(
  t: GpaTranslations,
  totals: GpaTotals,
  courses: Course[],
): string {
  const lines: string[] = [];
  lines.push(t.introTitle);
  lines.push("");
  lines.push(`${t.statUnweighted}: ${formatGpaStat(totals, totals.unweightedGpa, t)}`);
  lines.push(`${t.statWeighted}: ${formatGpaStat(totals, totals.weightedGpa, t)}`);
  lines.push(`${t.statTotalCredits}: ${formatCreditsDisplay(totals.totalCredits)}`);
  lines.push(`${t.statQuality}: ${formatQualityDisplay(totals, t)}`);
  lines.push("");
  lines.push(`${t.sectionCourses}:`);
  courses.forEach((c, i) => {
    const name = c.name.trim() || "—";
    const ex = c.excluded ? t.exportExcludeYes : t.exportExcludeNo;
    lines.push(
      `  ${i + 1}. ${name} | ${t.grade}: ${c.gradeKey} | ${t.credits}: ${c.credits} | ${t.level}: ${t.levels[c.level]} | ${t.exportCourseStatus}: ${ex}`,
    );
  });
  return lines.join("\n");
}

/** JSON export with localized keys for readability. */
export function buildGpaResultJson(
  language: GpaLang,
  t: GpaTranslations,
  totals: GpaTotals,
  courses: Course[],
  gradeScale: Record<string, number>,
): string {
  const localizedScale: Record<string, number> = {};
  for (const letter of GRADE_LETTERS) {
    if (letter in gradeScale) {
      localizedScale[letter] = gradeScale[letter] ?? 0;
    }
  }

  const payload: Record<string, unknown> = {
    [t.exportMetaLanguage]: language,
    [t.statUnweighted]:
      totals.countedCourses === 0 ? null : Number(totals.unweightedGpa.toFixed(4)),
    [t.statWeighted]:
      totals.countedCourses === 0 ? null : Number(totals.weightedGpa.toFixed(4)),
    [t.statTotalCredits]: totals.totalCredits,
    [t.statQuality]: {
      unweighted: totals.unweightedQualityPoints,
      weighted: totals.weightedQualityPoints,
    },
    [t.sectionCourses]: courses.map((c) => ({
      [t.courseName]: c.name.trim() || null,
      [t.grade]: c.gradeKey,
      [t.credits]: c.credits,
      [t.level]: t.levels[c.level],
      levelCode: c.level,
      [t.exportCourseStatus]: c.excluded
        ? t.exportExcludeYes
        : t.exportExcludeNo,
    })),
    [t.customScaleTitle]: localizedScale,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function triggerTextDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

/** Subset OTF from Noto Sans SC (Simplified Chinese), pinned release. */
const NOTO_SANS_SC_OTF_CDN =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf";

const PDF_FONT_ZH_VFS_NAME = "NotoSansSC-Regular.otf";
const PDF_FONT_ZH_FAMILY = "NotoSansSC";

export type PdfFontConfig = {
  family: string;
  footerFontStyle: "italic" | "normal";
};

let notoSansScBase64Cache: string | null = null;
let notoSansScLoadPromise: Promise<string> | null = null;

function getPublicFontUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${path.replace(/^\//, "")}`;
}

async function fetchNotoSansScBytes(): Promise<ArrayBuffer> {
  const localUrl = getPublicFontUrl("fonts/NotoSansSC-Regular.otf");
  let res = await fetch(localUrl);
  if (!res.ok) {
    res = await fetch(NOTO_SANS_SC_OTF_CDN);
  }
  if (!res.ok) {
    throw new Error("Could not load Noto Sans SC font (local or CDN).");
  }
  return res.arrayBuffer();
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Font encoding failed."));
        return;
      }
      const i = dataUrl.indexOf(",");
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

async function loadNotoSansScBase64(): Promise<string> {
  if (notoSansScBase64Cache) return notoSansScBase64Cache;
  if (!notoSansScLoadPromise) {
    notoSansScLoadPromise = (async () => {
      const buf = await fetchNotoSansScBytes();
      const b64 = await arrayBufferToBase64(buf);
      notoSansScBase64Cache = b64;
      return b64;
    })();
  }
  return notoSansScLoadPromise;
}

/**
 * Register fonts on the jsPDF instance. English: built-in Helvetica. Chinese: embedded Noto Sans SC.
 */
export async function registerPdfFonts(
  doc: jsPDF,
  language: GpaLang,
): Promise<PdfFontConfig> {
  if (language !== "zh") {
    return { family: "helvetica", footerFontStyle: "italic" };
  }

  const b64 = await loadNotoSansScBase64();
  doc.addFileToVFS(PDF_FONT_ZH_VFS_NAME, b64);
  doc.addFont(PDF_FONT_ZH_VFS_NAME, PDF_FONT_ZH_FAMILY, "normal");
  doc.addFont(PDF_FONT_ZH_VFS_NAME, PDF_FONT_ZH_FAMILY, "bold");

  return { family: PDF_FONT_ZH_FAMILY, footerFontStyle: "normal" };
}

/**
 * Build and download `gpa-report.pdf` using the same numeric formatting as the UI.
 * For `zh`, loads and embeds Noto Sans SC (subset) so CJK glyphs render correctly.
 */
export async function exportGpaPdf(
  language: GpaLang,
  t: GpaTranslations,
  totals: GpaTotals,
  courses: Course[],
): Promise<void> {
  const L = pdfLabels[language];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fontCfg = await registerPdfFonts(doc, language);

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  doc.setFont(fontCfg.family, "bold");
  doc.setFontSize(18);
  doc.text(L.reportTitle, pageW / 2, y, { align: "center" });
  y += 12;

  doc.setFont(fontCfg.family, "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const summaryRows: [string, string][] = [
    [L.unweighted, formatGpaStat(totals, totals.unweightedGpa, t)],
    [L.weighted, formatGpaStat(totals, totals.weightedGpa, t)],
    [L.totalCredits, formatCreditsDisplay(totals.totalCredits)],
    [L.qualityPoints, formatQualityDisplay(totals, t)],
  ];

  for (const [label, value] of summaryRows) {
    doc.text(`${label}: ${value}`, margin, y);
    y += 7;
  }

  y += 4;
  doc.setFont(fontCfg.family, "bold");
  doc.setFontSize(12);
  doc.text(L.courseList, margin, y);
  y += 6;

  const tableBody = courses.map((c) => {
    const name = c.name.trim() || "—";
    const status = c.excluded ? L.excluded : L.included;
    return [
      name,
      c.gradeKey,
      formatCourseCreditsCell(c.credits),
      t.levels[c.level],
      status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[L.courseName, L.grade, L.credits, L.level, L.status]],
    body: tableBody,
    styles: {
      font: fontCfg.family,
      fontSize: 9,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      font: fontCfg.family,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    margin: { left: margin, right: margin },
  });

  const finalY =
    (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y + 40;

  doc.setFont(fontCfg.family, fontCfg.footerFontStyle);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const exported = new Date().toLocaleString(
    language === "zh" ? "zh-CN" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );
  doc.text(`${L.exportedAt} ${exported}`, margin, finalY + 10);

  doc.save("gpa-report.pdf");
}

// —— Subcomponents ————————————————————————————————————————————————

function LanguageToggle({
  language,
  setLanguage,
  t,
}: {
  language: GpaLang;
  setLanguage: (l: GpaLang) => void;
  t: GpaTranslations;
}) {
  const pill =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:text-sm";
  const active = "bg-white text-blue-700 shadow-sm";
  const idle = "text-slate-600 hover:text-slate-900";

  return (
    <div
      className="flex shrink-0 items-center rounded-lg border border-slate-200/90 bg-slate-50/90 p-0.5 shadow-sm"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        className={`${pill} ${language === "en" ? active : idle}`}
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        {t.lang.en}
      </button>
      <button
        type="button"
        className={`${pill} ${language === "zh" ? active : idle}`}
        aria-pressed={language === "zh"}
        onClick={() => setLanguage("zh")}
      >
        {t.lang.zh}
      </button>
    </div>
  );
}

function PageHeader({
  t,
  language,
  setLanguage,
}: {
  t: GpaTranslations;
  language: GpaLang;
  setLanguage: (l: GpaLang) => void;
}) {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
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
              <Calculator className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              {t.gpaCalculator}
            </span>
          </div>
          <HubAuthNav lang={language} compact />
          <LanguageToggle
            language={language}
            setLanguage={setLanguage}
            t={t}
          />
        </div>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "indigo" | "slate";
}) {
  const ring =
    accent === "blue"
      ? "ring-blue-100"
      : accent === "indigo"
        ? "ring-indigo-100"
        : "ring-slate-100";
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ${ring}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      ) : null}
    </div>
  );
}

function CustomScalePanel({
  scale,
  onChange,
  onReset,
  t,
  open,
  onOpenChange,
}: {
  scale: Record<string, number>;
  onChange: (letter: string, value: number) => void;
  onReset: () => void;
  t: GpaTranslations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 shadow-sm ring-1 ring-slate-100">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition hover:bg-white/60"
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 shrink-0 text-blue-600" strokeWidth={1.75} />
          <div>
            <p className="font-semibold text-slate-900">{t.customScaleTitle}</p>
            <p className="text-sm text-slate-600">{t.customScaleSubtitle}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        )}
      </button>
      {open ? (
        <div className="border-t border-slate-200/80 px-5 pb-5 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GRADE_LETTERS.map((letter) => (
              <label
                key={letter}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {letter}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={6}
                  value={scale[letter] ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onChange(letter, Number.isFinite(v) ? v : 0);
                  }}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm font-medium tabular-nums text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            {t.resetScale}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CourseCard({
  course,
  gradeOptions,
  gradeScale,
  onUpdate,
  onRemove,
  canRemove,
  t,
}: {
  course: Course;
  gradeOptions: string[];
  gradeScale: Record<string, number>;
  onUpdate: (id: string, patch: Partial<Course>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  t: GpaTranslations;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition ${course.excluded ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t.courseName}
          </label>
          <input
            type="text"
            value={course.name}
            placeholder={t.courseNamePlaceholder}
            onChange={(e) => onUpdate(course.id, { name: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
          />
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-2xl lg:flex-1">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.grade}
            </label>
            <select
              value={
                gradeOptions.includes(course.gradeKey)
                  ? course.gradeKey
                  : gradeOptions[0] ?? "B"
              }
              onChange={(e) =>
                onUpdate(course.id, { gradeKey: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g} ({t.gradePtsSuffix((gradeScale[g] ?? 0).toFixed(2))})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.credits}
            </label>
            <input
              type="number"
              step="0.25"
              min={0}
              value={course.credits}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdate(course.id, {
                  credits: Number.isFinite(v) ? Math.max(0, v) : 0,
                });
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium tabular-nums text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.level}
            </label>
            <select
              value={course.level}
              onChange={(e) =>
                onUpdate(course.id, {
                  level: e.target.value as CourseLevel,
                })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
            >
              {LEVEL_ORDER.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {t.levels[lvl]}
                  {LEVEL_WEIGHTS[lvl] > 0
                    ? t.levelWeightedSuffix(
                        LEVEL_WEIGHTS[lvl].toFixed(1),
                      )
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:flex-col lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={course.excluded}
              onChange={(e) =>
                onUpdate(course.id, { excluded: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {t.exclude}
          </label>
          <button
            type="button"
            disabled={!canRemove}
            onClick={() => onRemove(course.id)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {t.remove}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Page —————————————————————————————————————————————————————————

export function GpaCalculatorPage() {
  const initRef = useRef<PersistedGpaCalculatorState | null>(null);
  if (initRef.current === null) {
    initRef.current = loadSavedCalculatorState() ?? getDefaultCalculatorState();
  }
  const s0 = initRef.current;

  const [language, setLanguage] = useState<GpaLang>(() => s0.language);
  const [courses, setCourses] = useState<Course[]>(() => s0.courses);
  const [gradeScale, setGradeScale] = useState<Record<string, number>>(
    () => s0.customScale,
  );
  const [customScaleOpen, setCustomScaleOpen] = useState(
    () => s0.isCustomScaleOpen,
  );

  const t = translations[language];

  useEffect(() => {
    saveCalculatorState({
      courses,
      customScale: gradeScale,
      isCustomScaleOpen: customScaleOpen,
      language,
    });
  }, [courses, gradeScale, customScaleOpen, language]);

  const resetSavedData = useCallback(() => {
    try {
      localStorage.removeItem(GPA_CALCULATOR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const d = getDefaultCalculatorState();
    setCourses(d.courses);
    setGradeScale(d.customScale);
    setLanguage(d.language);
    setCustomScaleOpen(d.isCustomScaleOpen);
  }, []);

  const [demoLoadedMsg, setDemoLoadedMsg] = useState(false);

  useEffect(() => {
    if (!demoLoadedMsg) return;
    const id = window.setTimeout(() => setDemoLoadedMsg(false), 2500);
    return () => clearTimeout(id);
  }, [demoLoadedMsg]);

  const loadDemoData = useCallback(() => {
    setCourses(getDemoCourses());
    setDemoLoadedMsg(true);
  }, []);

  const gradeOptions = useMemo(
    () => GRADE_LETTERS.filter((g) => g in gradeScale),
    [gradeScale],
  );

  const totals = useMemo(
    () => computeGpaTotals(courses, gradeScale, LEVEL_WEIGHTS),
    [courses, gradeScale],
  );

  const updateCourse = useCallback((id: string, patch: Partial<Course>) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const addCourse = useCallback(() => {
    setCourses((prev) => [...prev, createEmptyCourse()]);
  }, []);

  const removeCourse = useCallback((id: string) => {
    setCourses((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const resetScale = useCallback(() => {
    setGradeScale({ ...DEFAULT_GRADE_SCALE });
  }, []);

  const patchScale = useCallback((letter: string, value: number) => {
    setGradeScale((s) => ({ ...s, [letter]: value }));
  }, []);

  const canRemove = courses.length > 1;

  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const id = window.setTimeout(() => setCopyFeedback("idle"), 2500);
    return () => clearTimeout(id);
  }, [copyFeedback]);

  const handleCopySummary = useCallback(async () => {
    const text = buildGpaSummaryText(t, totals, courses);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("success");
    } catch {
      setCopyFeedback("error");
    }
  }, [t, totals, courses]);

  const handleDownloadSummaryTxt = useCallback(() => {
    const text = buildGpaSummaryText(t, totals, courses);
    triggerTextDownload(
      "gpa-summary.txt",
      text,
      "text/plain;charset=utf-8",
    );
  }, [t, totals, courses]);

  const handleDownloadDataJson = useCallback(() => {
    const json = buildGpaResultJson(
      language,
      t,
      totals,
      courses,
      gradeScale,
    );
    triggerTextDownload(
      "gpa-result.json",
      json,
      "application/json;charset=utf-8",
    );
  }, [language, t, totals, courses, gradeScale]);

  const handleDownloadPdf = useCallback(() => {
    void exportGpaPdf(language, t, totals, courses).catch((err) => {
      console.error(err);
    });
  }, [language, t, totals, courses]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <PageHeader t={t} language={language} setLanguage={setLanguage} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t.introTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">{t.introBody}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={loadDemoData}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t.loadDemoData}
              </button>
              <button
                type="button"
                onClick={resetSavedData}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-red-700"
              >
                {t.resetSavedData}
              </button>
            </div>
            {demoLoadedMsg ? (
              <p className="text-right text-sm font-medium text-emerald-600">
                {t.demoLoaded}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t.statUnweighted}
            value={
              totals.countedCourses === 0
                ? t.emptyGpa
                : formatGpa(totals.unweightedGpa, t.emptyGpa)
            }
            sub={t.statUnweightedSub}
            accent="blue"
          />
          <StatCard
            label={t.statWeighted}
            value={
              totals.countedCourses === 0
                ? t.emptyGpa
                : formatGpa(totals.weightedGpa, t.emptyGpa)
            }
            sub={t.statWeightedSub}
            accent="indigo"
          />
          <StatCard
            label={t.statTotalCredits}
            value={
              totals.totalCredits === 0
                ? "0"
                : totals.totalCredits % 1 === 0
                  ? String(totals.totalCredits)
                  : totals.totalCredits.toFixed(2)
            }
            sub={t.statTotalCreditsSub}
            accent="slate"
          />
          <StatCard
            label={t.statQuality}
            value={
              totals.countedCourses === 0
                ? t.emptyGpa
                : `${totals.unweightedQualityPoints.toFixed(2)} / ${totals.weightedQualityPoints.toFixed(2)}`
            }
            sub={t.statQualitySub}
            accent="slate"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4 shrink-0" strokeWidth={2} />
            {t.copySummary}
          </button>
          <button
            type="button"
            onClick={handleDownloadSummaryTxt}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
            {t.downloadSummaryTxt}
          </button>
          <button
            type="button"
            onClick={handleDownloadDataJson}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
            {t.downloadDataJson}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
            {t.downloadPdf}
          </button>
          {copyFeedback === "success" ? (
            <span className="text-sm font-medium text-emerald-600">
              {t.copied}
            </span>
          ) : copyFeedback === "error" ? (
            <span className="text-sm font-medium text-red-600">
              {t.copyFailed}
            </span>
          ) : null}
        </div>

        <section className="mt-10 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {t.sectionCourses}
            </h2>
            <button
              type="button"
              onClick={addCourse}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {t.addCourse}
            </button>
          </div>

          <div className="space-y-4">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                gradeOptions={gradeOptions}
                gradeScale={gradeScale}
                onUpdate={updateCourse}
                onRemove={removeCourse}
                canRemove={canRemove}
                t={t}
              />
            ))}
          </div>
        </section>

        <div className="mt-10">
          <CustomScalePanel
            scale={gradeScale}
            onChange={patchScale}
            onReset={resetScale}
            t={t}
            open={customScaleOpen}
            onOpenChange={setCustomScaleOpen}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm ring-1 ring-amber-100">
          <p className="text-sm font-medium leading-relaxed text-amber-950">
            <strong className="font-semibold">{t.disclaimerLabel}</strong>{" "}
            {t.disclaimerBody}
          </p>
        </div>
      </main>
    </div>
  );
}
