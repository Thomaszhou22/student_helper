import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router-dom";
import { HubAuthNav } from "./components/HubAuthNav";
import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";
import mammoth from "mammoth";
import { jsPDF } from "jspdf";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Files,
  GripVertical,
  Layers,
  Loader2,
  Minimize2,
  Scissors,
  Trash2,
  Upload,
} from "lucide-react";

// —— i18n ——————————————————————————————————————————————————————————

export type PdfLang = "en" | "zh";

type Translations = {
  lang: { en: string; zh: string };
  backToHub: string;
  pageTitle: string;
  introLead: string;
  introSub: string;
  mergeHelp: string;
  mergeTitle: string;
  splitTitle: string;
  compressTitle: string;
  wordTitle: string;
  wordDesc: string;
  wordUploadPrompt: string;
  wordUploadHint: string;
  wordDropHere: string;
  wordConvert: string;
  wordConverting: string;
  wordDownload: string;
  wordHelperNote: string;
  wordNoFile: string;
  wordPreview: string;
  uploadPrompt: string;
  uploadHint: string;
  dropHere: string;
  filesSelected: string;
  fileSize: string;
  removeFile: string;
  moveUp: string;
  moveDown: string;
  merge: string;
  merging: string;
  downloadMerged: string;
  mergedFilename: string;
  splitModeEach: string;
  splitModeRanges: string;
  rangesLabel: string;
  rangesPlaceholder: string;
  rangesHelp: string;
  split: string;
  splitting: string;
  downloadSplit: (name: string) => string;
  downloadAllSplit: string;
  splitPageSingle: (n: number) => string;
  splitPagesRange: (a: number, b: number) => string;
  compressLevelLow: string;
  compressLevelBalanced: string;
  compressLevelHigh: string;
  compressLevelLowDesc: string;
  compressLevelBalancedDesc: string;
  compressLevelHighDesc: string;
  compress: string;
  compressing: string;
  downloadCompressed: string;
  compressedFilename: string;
  originalSize: string;
  newSize: string;
  reduction: string;
  compressNoteTitle: string;
  compressNoteBody: string;
  errPdfOnly: string;
  errDocxOnly: string;
  errMergeNeedTwo: string;
  errNoFile: string;
  errParseRanges: string;
  errPageOutOfRange: (max: number) => string;
  errInvalidRange: string;
  errMergeFailed: string;
  errSplitFailed: string;
  errCompressFailed: string;
  errWordConvertFailed: string;
  errWordEmpty: string;
  errWordRenderPdf: string;
  successMerge: string;
  successSplit: (n: number) => string;
  successCompress: string;
  successWord: string;
  clearResult: string;
};

const translations: Record<PdfLang, Translations> = {
  en: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "Back to hub",
    pageTitle: "PDF Toolkit",
    introLead:
      "Merge, split, and compress PDF files, or turn a simple Word document into a PDF for class assignments, applications, and school submissions.",
    introSub:
      "Student-friendly tools for assignment uploads and document preparation. Everything runs in your browser—no uploads to a server.",
    mergeHelp:
      "Add two or more PDFs. Drag the handle to set the order in the combined file.",
    mergeTitle: "Merge PDF",
    splitTitle: "Split PDF",
    compressTitle: "Compress PDF",
    wordTitle: "Word to PDF",
    wordDesc:
      "Convert simple Word documents into PDF for school submissions.",
    wordUploadPrompt: "Choose a Word file",
    wordUploadHint: "or drag and drop a .docx here",
    wordDropHere: "Drop your .docx file here",
    wordConvert: "Convert to PDF",
    wordConverting: "Converting…",
    wordDownload: "Download PDF",
    wordHelperNote:
      "Best for simple text-based .docx files. Complex layouts may not convert perfectly.",
    wordNoFile: "Please choose a .docx file first.",
    wordPreview: "Document preview (from Word)",
    uploadPrompt: "Choose PDF files",
    uploadHint: "or drag and drop here",
    dropHere: "Drop PDF files here",
    filesSelected: "Files",
    fileSize: "Size",
    removeFile: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    merge: "Merge into one PDF",
    merging: "Merging…",
    downloadMerged: "Download merged PDF",
    mergedFilename: "merged.pdf",
    splitModeEach: "Every page as a separate PDF",
    splitModeRanges: "Custom page ranges",
    rangesLabel: "Page ranges",
    rangesPlaceholder: "e.g. 1-3, 5, 7-9",
    rangesHelp:
      "Use commas between groups. Ranges use a hyphen (1-3). Page numbers start at 1.",
    split: "Split PDF",
    splitting: "Splitting…",
    downloadSplit: (name) => `Download ${name}`,
    downloadAllSplit: "Download all",
    splitPageSingle: (n) => `split-page-${n}.pdf`,
    splitPagesRange: (a, b) => `split-pages-${a}-${b}.pdf`,
    compressLevelLow: "Low compression (better quality)",
    compressLevelBalanced: "Balanced",
    compressLevelHigh: "High compression (smaller file)",
    compressLevelLowDesc: "Larger file, keeps structure closer to the original.",
    compressLevelBalancedDesc: "Good default for most school uploads.",
    compressLevelHighDesc: "Smaller file; quality may drop on image-heavy PDFs.",
    compress: "Compress PDF",
    compressing: "Compressing…",
    downloadCompressed: "Download compressed PDF",
    compressedFilename: "compressed.pdf",
    originalSize: "Original size",
    newSize: "Compressed size",
    reduction: "Estimated reduction",
    compressNoteTitle: "About compression",
    compressNoteBody:
      "True PDF compression in the browser is limited. We rebuild the PDF with efficient save options—savings vary by file. For strict portal limits, try high compression or split large documents.",
    errPdfOnly: "Please upload PDF files only (.pdf).",
    errDocxOnly: "Please upload a Word file in .docx format only.",
    errMergeNeedTwo: "Add at least two PDF files to merge.",
    errNoFile: "Please upload a PDF first.",
    errParseRanges:
      "Could not parse page ranges. Use numbers like 1-3, 5, or 7-9 separated by commas.",
    errPageOutOfRange: (max) => `All pages must be between 1 and ${max}.`,
    errInvalidRange: "Each range must start with a page ≤ the end page.",
    errMergeFailed: "Merge failed. The file may be protected or corrupted.",
    errSplitFailed: "Split failed. The file may be protected or corrupted.",
    errCompressFailed:
      "Compression failed. The file may be protected or corrupted.",
    errWordConvertFailed:
      "Could not convert this file. It may be corrupted, password-protected, or not a valid .docx.",
    errWordEmpty:
      "This Word file has no readable text or content we could use. Try a different .docx.",
    errWordRenderPdf:
      "Could not render this Word file into PDF. Please try a simpler .docx document.",
    successMerge: "Merged PDF is ready to download.",
    successSplit: (n) => `Created ${n} PDF file(s).`,
    successCompress: "Compressed PDF is ready to download.",
    successWord: "PDF is ready to download.",
    clearResult: "Clear",
  },
  zh: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "返回首页",
    pageTitle: "PDF 工具箱",
    introLead:
      "合并、拆分和压缩 PDF 文件，也可将简单的 Word 文档转为 PDF，适合作业、申请材料和学校提交。",
    introSub:
      "面向学生的文档工具，方便作业上传与整理。全部在浏览器本地处理，不会上传到服务器。",
    mergeHelp:
      "至少添加两个 PDF。拖动手柄可调整合并后的文件顺序。",
    mergeTitle: "合并 PDF",
    splitTitle: "拆分 PDF",
    compressTitle: "压缩 PDF",
    wordTitle: "Word 转 PDF",
    wordDesc: "将简单的 Word 文档转换为 PDF，方便学校提交。",
    wordUploadPrompt: "选择 Word 文件",
    wordUploadHint: "或将 .docx 拖放到此处",
    wordDropHere: "将 .docx 文件拖放到这里",
    wordConvert: "转换为 PDF",
    wordConverting: "正在转换…",
    wordDownload: "下载 PDF",
    wordHelperNote:
      "更适合以文字为主的 .docx 文档，复杂排版可能无法完全保留。",
    wordNoFile: "请先选择一个 .docx 文件。",
    wordPreview: "文档预览（来自 Word）",
    uploadPrompt: "选择 PDF 文件",
    uploadHint: "或拖拽到此处",
    dropHere: "将 PDF 文件拖放到这里",
    filesSelected: "文件",
    fileSize: "大小",
    removeFile: "移除",
    moveUp: "上移",
    moveDown: "下移",
    merge: "合并为一个 PDF",
    merging: "正在合并…",
    downloadMerged: "下载合并后的 PDF",
    mergedFilename: "merged.pdf",
    splitModeEach: "每一页单独一个 PDF",
    splitModeRanges: "自定义页码范围",
    rangesLabel: "页码范围",
    rangesPlaceholder: "例如：1-3, 5, 7-9",
    rangesHelp:
      "用英文逗号分隔多组。范围用连字符（1-3）。页码从 1 开始。",
    split: "拆分 PDF",
    splitting: "正在拆分…",
    downloadSplit: (name) => `下载 ${name}`,
    downloadAllSplit: "全部下载",
    splitPageSingle: (n) => `split-page-${n}.pdf`,
    splitPagesRange: (a, b) => `split-pages-${a}-${b}.pdf`,
    compressLevelLow: "低压缩（画质更好）",
    compressLevelBalanced: "平衡",
    compressLevelHigh: "高压缩（文件更小）",
    compressLevelLowDesc: "文件较大，结构更接近原文件。",
    compressLevelBalancedDesc: "适合大多数学校上传场景。",
    compressLevelHighDesc: "文件更小；扫描件或图片多的 PDF 画质可能下降。",
    compress: "压缩 PDF",
    compressing: "正在压缩…",
    downloadCompressed: "下载压缩后的 PDF",
    compressedFilename: "compressed.pdf",
    originalSize: "原始大小",
    newSize: "压缩后大小",
    reduction: "约减少",
    compressNoteTitle: "关于压缩",
    compressNoteBody:
      "浏览器内 PDF 压缩能力有限。我们会用更高效的保存方式重建 PDF，实际效果因文件而异。若上传限制很严，可尝试高压缩或先拆分大文件。",
    errPdfOnly: "请仅上传 PDF 文件（.pdf）。",
    errDocxOnly: "请仅上传 Word 文件（.docx）。",
    errMergeNeedTwo: "合并至少需要两个 PDF 文件。",
    errNoFile: "请先上传一个 PDF。",
    errParseRanges: "无法解析页码范围。请使用如 1-3、5、7-9，并用逗号分隔。",
    errPageOutOfRange: (max) => `页码必须在 1 到 ${max} 之间。`,
    errInvalidRange: "范围的起始页不能大于结束页。",
    errMergeFailed: "合并失败。文件可能已加密或已损坏。",
    errSplitFailed: "拆分失败。文件可能已加密或已损坏。",
    errCompressFailed: "压缩失败。文件可能已加密或已损坏。",
    errWordConvertFailed:
      "无法转换此文件。文件可能已损坏、已加密，或不是有效的 .docx。",
    errWordEmpty:
      "未能从该 Word 文件中读取可用的文字或内容，请尝试其他 .docx。",
    errWordRenderPdf:
      "无法将该 Word 文件渲染为 PDF，请尝试较简单的 .docx 文档。",
    successMerge: "合并完成，可以下载。",
    successSplit: (n) => `已生成 ${n} 个 PDF 文件。`,
    successCompress: "压缩完成，可以下载。",
    successWord: "转换完成，可以下载。",
    clearResult: "清除",
  },
};

// —— Helpers —————————————————————————————————————————————————————

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : x < 10 ? 1 : x < 100 ? 1 : 0;
  return `${x.toFixed(digits)} ${u[i]}`;
}

function downloadUint8Array(data: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
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

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  );
}

function docxBasenameToPdfName(filename: string): string {
  const base = filename.replace(/\.docx$/i, "").trim() || "document";
  return `${base}.pdf`;
}

/** PDF margins (mm) — must match how we map the HTML column to the page (applied once here). */
const WORD_PDF_MARGIN_LEFT_MM = 20;
const WORD_PDF_MARGIN_RIGHT_MM = 20;
const WORD_PDF_MARGIN_TOP_MM = 24;
const WORD_PDF_MARGIN_BOTTOM_MM = 24;

const WORD_PAGE_W_MM = 210;
const WORD_PAGE_H_MM = 297;
/** CSS px per mm at 96dpi — HTML column width matches printable width. */
const WORD_MM_TO_CSS_PX = 96 / 25.4;

/** Printable width/height on A4 after margins (mm). */
const WORD_PRINTABLE_W_MM =
  WORD_PAGE_W_MM - WORD_PDF_MARGIN_LEFT_MM - WORD_PDF_MARGIN_RIGHT_MM;
const WORD_PRINTABLE_H_MM =
  WORD_PAGE_H_MM - WORD_PDF_MARGIN_TOP_MM - WORD_PDF_MARGIN_BOTTOM_MM;

/** Avoid a final “orphan” band of one word / one line (image-slice pagination). */
const WORD_MIN_LAST_PAGE_MM = 22;
/** Minimum content on a page we steal from when rebalancing (≈2 short lines). */
const WORD_MIN_PAGE_BODY_MM = 14;

/**
 * Extra canvas px per full page band (html2canvas scale≈2). Pulls the cut below descenders;
 * PDF height is still capped to WORD_PRINTABLE_H_MM so content is slightly vertically compressed
 * instead of clipped at the page box.
 */
const WORD_SLICE_DESCENDER_PAD_PX = 4;

/**
 * Bottom padding inside the capture root so the final line’s descenders are not flush with
 * the bitmap edge (last page has no “next band” to borrow px from).
 */
const WORD_EXPORT_ROOT_PADDING_BOTTOM_PX = 24;

const WORD_PAGE_FONT =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

/** Styles for Mammoth HTML in the preview / export root (scoped by class). */
const WORD_EXPORT_INNER_CSS = `
  .pdf-toolkit-word-html-inner {
    overflow: visible;
    line-height: 1.5;
    color: #1a1a1a;
  }
  .pdf-toolkit-word-html-inner table { border-collapse: collapse; width: 100%; margin: 0.85em 0; }
  .pdf-toolkit-word-html-inner th, .pdf-toolkit-word-html-inner td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  .pdf-toolkit-word-html-inner p { margin: 0.5em 0; }
  .pdf-toolkit-word-html-inner h1 { font-size: 1.35rem; font-weight: 700; margin: 0.75em 0 0.4em; line-height: 1.3; }
  .pdf-toolkit-word-html-inner h2 { font-size: 1.15rem; font-weight: 700; margin: 0.65em 0 0.35em; line-height: 1.3; }
  .pdf-toolkit-word-html-inner h3 { font-size: 1.05rem; font-weight: 600; margin: 0.55em 0 0.3em; line-height: 1.35; }
  .pdf-toolkit-word-html-inner ul, .pdf-toolkit-word-html-inner ol { margin: 0.55em 0; padding-left: 1.35em; }
  .pdf-toolkit-word-html-inner li { margin: 0.2em 0; }
  .pdf-toolkit-word-html-inner img { max-width: 100%; height: auto; }
`;

/** Body column width in CSS px — same physical width as `WORD_PRINTABLE_W_MM`. */
const WORD_EXPORT_BODY_WIDTH = WORD_PRINTABLE_W_MM * WORD_MM_TO_CSS_PX;

function extractTopLevelBlocks(html: string): HTMLElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="word-export-root">${html}</div>`,
    "text/html",
  );
  const root = doc.querySelector("#word-export-root");
  if (!root) return [];
  return Array.from(root.children).map(
    (c) => document.importNode(c, true) as HTMLElement,
  );
}

function wordHtmlHasRenderableContent(html: string): boolean {
  const blocks = extractTopLevelBlocks(html);
  for (const b of blocks) {
    if ((b.textContent?.trim() ?? "").length > 0) return true;
    if (b.querySelector("img")) return true;
  }
  return false;
}

type WordExportIssue = "null" | "no-content" | "no-height";

function diagnoseWordExportRoot(
  root: HTMLDivElement | null,
): WordExportIssue | null {
  if (!root) return "null";
  const text = root.innerText?.trim() ?? "";
  const hasImg = root.querySelector("img") != null;
  if (!text && !hasImg) return "no-content";
  if (root.scrollHeight < 4 || root.scrollWidth < 4) return "no-height";
  return null;
}

type WordPdfSlice = {
  startMm: number;
  endMm: number;
  startPx: number;
  endPx: number;
};

/**
 * Pixel-first pagination with **integer row boundaries** only.
 * Full interior bands use ceil(stepPx) + small pad so cuts sit past descenders (floor was
 * slicing through glyph bottoms). Last band consumes the remainder; sums to canvasHeight.
 */
function buildWordPdfSlices(
  imgHeightMm: number,
  canvasHeight: number,
  printableHmm: number,
): WordPdfSlice[] {
  const stepPxFloat = (printableHmm / imgHeightMm) * canvasHeight;
  const stepPxInt = Math.max(1, Math.ceil(stepPxFloat));
  const fullChunkPx = stepPxInt + WORD_SLICE_DESCENDER_PAD_PX;
  const slices: WordPdfSlice[] = [];
  let startPx = 0;
  while (startPx < canvasHeight) {
    const remaining = canvasHeight - startPx;
    const chunkPx =
      remaining <= fullChunkPx ? remaining : fullChunkPx;
    const endPx = startPx + chunkPx;
    const startMm = (startPx / canvasHeight) * imgHeightMm;
    const endMm = (endPx / canvasHeight) * imgHeightMm;
    slices.push({ startMm, endMm, startPx, endPx });
    startPx = endPx;
  }
  return slices;
}

/**
 * Merge or re-split the last two bands so the final page is not a tiny fragment.
 * Uses mm/px ranges only (no paragraph geometry — raster export limitation).
 */
function rebalanceWordPdfSlicesForWidows(
  slices: WordPdfSlice[],
  imgHeightMm: number,
  canvasHeight: number,
  pageStepMm: number,
): void {
  if (slices.length < 2) return;

  const last = slices[slices.length - 1];
  const lastHmm = last.endMm - last.startMm;
  if (lastHmm >= WORD_MIN_LAST_PAGE_MM - 1e-6) return;

  const prev = slices[slices.length - 2];
  const combinedStartMm = prev.startMm;
  const combinedEndMm = last.endMm;
  const combinedStartPx = prev.startPx;
  const combinedEndPx = last.endPx;
  const totalHmm = combinedEndMm - combinedStartMm;

  if (combinedEndPx - combinedStartPx < 2) {
    return;
  }

  if (totalHmm <= pageStepMm + 1e-6) {
    slices.splice(slices.length - 2, 2, {
      startMm: combinedStartMm,
      endMm: combinedEndMm,
      startPx: combinedStartPx,
      endPx: combinedEndPx,
    });
    if (import.meta.env.DEV) {
      console.warn(
        "[Word→PDF] merged tiny tail into one band (fits single printable height)",
      );
    }
    return;
  }

  let firstHmm = Math.min(pageStepMm, totalHmm - WORD_MIN_LAST_PAGE_MM);
  let secondHmm = totalHmm - firstHmm;

  if (secondHmm < WORD_MIN_LAST_PAGE_MM - 1e-6) {
    firstHmm = totalHmm - WORD_MIN_LAST_PAGE_MM;
    secondHmm = WORD_MIN_LAST_PAGE_MM;
  }

  if (firstHmm < WORD_MIN_PAGE_BODY_MM - 1e-6) {
    firstHmm = WORD_MIN_PAGE_BODY_MM;
    secondHmm = totalHmm - firstHmm;
    if (secondHmm < WORD_MIN_LAST_PAGE_MM - 1e-6) {
      secondHmm = Math.max(
        WORD_MIN_LAST_PAGE_MM,
        Math.min(totalHmm * 0.4, totalHmm - WORD_MIN_PAGE_BODY_MM),
      );
      firstHmm = totalHmm - secondHmm;
    }
  }

  if (firstHmm > pageStepMm + 1e-6) {
    firstHmm = pageStepMm;
    secondHmm = totalHmm - firstHmm;
  }

  if (secondHmm > pageStepMm + 1e-6) {
    secondHmm = pageStepMm;
    firstHmm = totalHmm - secondHmm;
  }

  if (secondHmm < WORD_MIN_LAST_PAGE_MM - 1e-6 && firstHmm > WORD_MIN_PAGE_BODY_MM + 1e-6) {
    const borrow = Math.min(
      firstHmm - WORD_MIN_PAGE_BODY_MM,
      WORD_MIN_LAST_PAGE_MM - secondHmm,
    );
    if (borrow > 1e-6) {
      firstHmm -= borrow;
      secondHmm += borrow;
    }
  }

  if (secondHmm < WORD_MIN_LAST_PAGE_MM - 1e-6) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Word→PDF] widow rebalance could not reach MIN_LAST; best-effort split",
        { totalHmm, firstHmm, secondHmm },
      );
    }
  }

  const midPxFloat =
    combinedStartPx + (firstHmm / imgHeightMm) * canvasHeight;
  let midPx = Math.round(midPxFloat);
  midPx = Math.max(
    combinedStartPx + 1,
    Math.min(combinedEndPx - 1, midPx),
  );
  const midMm = (midPx / canvasHeight) * imgHeightMm;

  slices[slices.length - 2] = {
    startMm: combinedStartMm,
    endMm: midMm,
    startPx: combinedStartPx,
    endPx: midPx,
  };
  slices[slices.length - 1] = {
    startMm: midMm,
    endMm: combinedEndMm,
    startPx: midPx,
    endPx: combinedEndPx,
  };

  if (import.meta.env.DEV) {
    console.warn("[Word→PDF] rebalanced last two bands (mm)", {
      firstHmm: firstHmm.toFixed(3),
      secondHmm: secondHmm.toFixed(3),
      totalHmm: totalHmm.toFixed(3),
    });
  }

  const tail = slices[slices.length - 1];
  if (
    slices.length >= 2 &&
    tail.endMm - tail.startMm < WORD_MIN_LAST_PAGE_MM - 1e-6
  ) {
    const p = slices[slices.length - 2];
    const combinedTailHmm = tail.endMm - p.startMm;
    if (combinedTailHmm <= pageStepMm + 1e-6) {
      slices.splice(slices.length - 2, 2, {
        startMm: p.startMm,
        endMm: tail.endMm,
        startPx: p.startPx,
        endPx: tail.endPx,
      });
      if (import.meta.env.DEV) {
        console.warn(
          "[Word→PDF] fallback: merged last two bands (tail still below MIN_LAST)",
        );
      }
    }
  }
}

/**
 * Rasterize the export column, then **crop the canvas** into contiguous vertical bands.
 * Each PDF page shows exactly one band [pageStartPx, pageEndPx) with matching mm band
 * [startMm, endMm); the next page uses startMm = previous endMm and startPx = previous endPx.
 * (Tiling one full image with negative y + margins is easy to get wrong in jsPDF and caused
 * repeated lines between pages.)
 */
async function exportWordDomToPdfBytes(root: HTMLElement): Promise<Uint8Array> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const w = root.scrollWidth;
  const h = root.scrollHeight;
  if (w < 1 || h < 1) {
    throw new Error("word-export-zero-bounds");
  }

  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: Boolean(import.meta.env.DEV),
  });

  if (canvas.width < 4 || canvas.height < 4) {
    throw new Error("html2canvas-empty-canvas");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  if (
    Math.abs(pdfW - WORD_PAGE_W_MM) > 0.5 ||
    Math.abs(pdfH - WORD_PAGE_H_MM) > 0.5
  ) {
    if (import.meta.env.DEV) {
      console.warn("[Word→PDF] unexpected jsPDF page size mm:", pdfW, pdfH);
    }
  }

  const marginL = WORD_PDF_MARGIN_LEFT_MM;
  const marginT = WORD_PDF_MARGIN_TOP_MM;
  const imgWidthMm = WORD_PRINTABLE_W_MM;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
  const pageStepMm = WORD_PRINTABLE_H_MM;

  const slices = buildWordPdfSlices(imgHeightMm, canvas.height, pageStepMm);
  rebalanceWordPdfSlicesForWidows(
    slices,
    imgHeightMm,
    canvas.height,
    pageStepMm,
  );

  const usableHmm = WORD_PRINTABLE_H_MM;
  const printableBottomMm = WORD_PDF_MARGIN_TOP_MM + usableHmm;

  let prevEndPx: number | null = null;

  for (let pageIdx = 0; pageIdx < slices.length; pageIdx++) {
    const { startMm, endMm, startPx: pageStartPx, endPx: pageEndPx } =
      slices[pageIdx];
    const slicePxInt = pageEndPx - pageStartPx;
    /** Physical mm for this bitmap slice (may exceed one printable page). */
    const renderedHmmRaw =
      (slicePxInt / canvas.height) * imgHeightMm;
    /** Cap so the image box never exceeds the printable band (viewer clip). Tiny squash OK. */
    const renderedHmmPdf = Math.min(renderedHmmRaw, usableHmm);
    const bandHmm = endMm - startMm;
    const driftMm = Math.abs(renderedHmmRaw - bandHmm);

    if (slicePxInt <= 0 || renderedHmmRaw <= 1e-6) {
      break;
    }

    if (import.meta.env.DEV) {
      const strict =
        prevEndPx === null || pageStartPx === prevEndPx;
      const bottomYmm = marginT + renderedHmmPdf;
      const exceedsPrintable = bottomYmm > printableBottomMm + 1e-3;
      const squashed =
        renderedHmmPdf + 1e-6 < renderedHmmRaw;
      console.warn(
        `[Word→PDF] page ${pageIdx}: srcY [${pageStartPx}, ${pageEndPx}) ` +
          `slicePx=${slicePxInt} ` +
          `rawHmm=${renderedHmmRaw.toFixed(4)} pdfHmm=${renderedHmmPdf.toFixed(4)} usable=${usableHmm.toFixed(4)} ` +
          `squashed=${squashed} bandHmm=${bandHmm.toFixed(4)} driftMm=${driftMm.toFixed(4)} ` +
          `bottomYmm=${bottomYmm.toFixed(3)} printableBottom=${printableBottomMm.toFixed(3)} ` +
          `exceeds=${exceedsPrintable} strictNext=${strict}`,
      );
      if (!strict) {
        console.error(
          "[Word→PDF] slice discontinuity: pageStartPx",
          pageStartPx,
          "prevEndPx",
          prevEndPx,
        );
      }
      if (exceedsPrintable) {
        console.error(
          "[Word→PDF] slice taller than printable area — check margins/stepPx",
        );
      }
    }

    if (pageIdx > 0) {
      pdf.addPage();
    }

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, slicePxInt);
    const sctx = sliceCanvas.getContext("2d");
    if (!sctx) {
      throw new Error("word-export-no-2d");
    }
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sctx.drawImage(
      canvas,
      0,
      pageStartPx,
      canvas.width,
      slicePxInt,
      0,
      0,
      canvas.width,
      slicePxInt,
    );

    const sliceUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(sliceUrl, "JPEG", marginL, marginT, imgWidthMm, renderedHmmPdf);

    prevEndPx = pageEndPx;

    if (pageIdx > 500) {
      throw new Error("word-export-too-many-pages");
    }
  }

  if (import.meta.env.DEV) {
    console.warn(
      "[Word→PDF] canvas px:",
      canvas.width,
      canvas.height,
      "root px:",
      w,
      h,
      "img mm H:",
      imgHeightMm.toFixed(3),
      "pages:",
      pdf.getNumberOfPages(),
    );
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}

type CompressLevel = "low" | "balanced" | "high";

/**
 * Client-side “compression” rebuilds the PDF via pdf-lib with different save
 * flags. It is not a full re-encode of streams; savings depend on the source
 * PDF. Stronger compression usually needs a server or native tools.
 */
async function compressPdfBytes(
  bytes: Uint8Array,
  level: CompressLevel,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const idx = src.getPageIndices();
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));

  if (level === "low") {
    return out.save({
      useObjectStreams: false,
      updateFieldAppearances: true,
    });
  }
  if (level === "balanced") {
    return out.save({
      useObjectStreams: true,
      updateFieldAppearances: true,
    });
  }
  return out.save({
    useObjectStreams: true,
    updateFieldAppearances: false,
  });
}

async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const raw = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(raw, { ignoreEncryption: true });
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  return merged.save({ useObjectStreams: true });
}

type RangeParseOk = {
  ok: true;
  groups: { label: string; indices0: number[] }[];
};

type RangeParseErr = { ok: false; message: string };

function parseRangeInput(
  input: string,
  pageCount: number,
  t: Translations,
): RangeParseOk | RangeParseErr {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: t.errParseRanges };

  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const groups: { label: string; indices0: number[] }[] = [];

  for (const part of parts) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (a < 1 || b < 1 || a > pageCount || b > pageCount) {
        return { ok: false, message: t.errPageOutOfRange(pageCount) };
      }
      if (a > b) return { ok: false, message: t.errInvalidRange };
      const indices0: number[] = [];
      for (let p = a; p <= b; p++) indices0.push(p - 1);
      groups.push({
        label: t.splitPagesRange(a, b),
        indices0,
      });
      continue;
    }
    const singleMatch = /^(\d+)$/.exec(part);
    if (singleMatch) {
      const n = Number(singleMatch[1]);
      if (n < 1 || n > pageCount) {
        return { ok: false, message: t.errPageOutOfRange(pageCount) };
      }
      groups.push({
        label: t.splitPageSingle(n),
        indices0: [n - 1],
      });
      continue;
    }
    return { ok: false, message: t.errParseRanges };
  }

  return { ok: true, groups };
}

async function splitPdfByGroups(
  bytes: Uint8Array,
  groups: { label: string; indices0: number[] }[],
): Promise<{ filename: string; data: Uint8Array }[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const outList: { filename: string; data: Uint8Array }[] = [];

  for (const g of groups) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, g.indices0);
    pages.forEach((p) => out.addPage(p));
    const data = await out.save({ useObjectStreams: true });
    outList.push({ filename: g.label, data });
  }
  return outList;
}

async function splitPdfEachPage(
  bytes: Uint8Array,
  t: Translations,
): Promise<{ filename: string; data: Uint8Array }[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const n = src.getPageCount();
  const outList: { filename: string; data: Uint8Array }[] = [];
  for (let i = 0; i < n; i++) {
    const out = await PDFDocument.create();
    const [p] = await out.copyPages(src, [i]);
    out.addPage(p);
    const data = await out.save({ useObjectStreams: true });
    outList.push({ filename: t.splitPageSingle(i + 1), data });
  }
  return outList;
}

// —— UI bits ———————————————————————————————————————————————————————

function LanguageToggle({
  language,
  setLanguage,
  t,
}: {
  language: PdfLang;
  setLanguage: (l: PdfLang) => void;
  t: Translations;
}) {
  const pill =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:text-sm";
  const active = "bg-white text-blue-700 shadow-sm";
  const idle = "text-slate-600 hover:text-slate-900";
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-slate-200/90 bg-slate-50/90 p-0.5 shadow-sm">
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

type MergeItem = { id: string; file: File };

export function PdfToolkitPage() {
  const [language, setLanguage] = useState<PdfLang>("en");
  const t = translations[language];
  const mergeInputId = useId();
  const splitInputId = useId();
  const compressInputId = useId();
  const wordInputId = useId();
  const wordExportRef = useRef<HTMLDivElement>(null);

  // —— Word → PDF ——
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [wordDragging, setWordDragging] = useState(false);
  const [wordBusy, setWordBusy] = useState(false);
  const [wordExportHtml, setWordExportHtml] = useState<string | null>(null);
  const [wordResult, setWordResult] = useState<Uint8Array | null>(null);
  const [wordPdfName, setWordPdfName] = useState("");
  const [wordStatus, setWordStatus] = useState<"ok" | "err" | null>(null);
  const [wordMessage, setWordMessage] = useState("");

  const addWordFile = (file: File) => {
    if (!isDocxFile(file)) {
      setWordStatus("err");
      setWordMessage(t.errDocxOnly);
      return;
    }
    setWordFile(file);
    setWordExportHtml(null);
    setWordResult(null);
    setWordPdfName("");
    setWordStatus(null);
    setWordMessage("");
  };

  const runWordConvert = async () => {
    if (!wordFile) {
      setWordStatus("err");
      setWordMessage(t.wordNoFile);
      return;
    }
    setWordBusy(true);
    setWordStatus(null);
    setWordMessage("");
    setWordResult(null);
    setWordPdfName("");
    setWordExportHtml(null);
    try {
      const buf = await wordFile.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
      if (!html.trim() || !wordHtmlHasRenderableContent(html)) {
        setWordStatus("err");
        setWordMessage(t.errWordEmpty);
        return;
      }

      setWordExportHtml(html);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      await new Promise<void>((r) => setTimeout(r, 0));

      const root = wordExportRef.current;
      const issue = diagnoseWordExportRoot(root);
      if (issue) {
        if (import.meta.env.DEV) {
          console.warn("[Word→PDF] export not ready:", issue, {
            node: root,
            scrollW: root?.scrollWidth,
            scrollH: root?.scrollHeight,
            innerLen: root?.innerHTML?.length,
            textLen: root?.innerText?.length,
          });
        }
        setWordStatus("err");
        setWordMessage(
          issue === "no-content" ? t.errWordEmpty : t.errWordRenderPdf,
        );
        return;
      }

      if (!root) {
        setWordStatus("err");
        setWordMessage(t.errWordRenderPdf);
        return;
      }

      const pdfBytes = await exportWordDomToPdfBytes(root);
      setWordResult(pdfBytes);
      setWordPdfName(docxBasenameToPdfName(wordFile.name));
      setWordStatus("ok");
      setWordMessage(t.successWord);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[Word→PDF] conversion failed:", e);
      }
      setWordResult(null);
      setWordPdfName("");
      setWordStatus("err");
      const renderLikely =
        e instanceof Error &&
        /html2canvas|canvas|word-export-zero/i.test(String(e.message));
      setWordMessage(
        renderLikely ? t.errWordRenderPdf : t.errWordConvertFailed,
      );
    } finally {
      setWordBusy(false);
    }
  };

  // —— Merge ——
  const [mergeItems, setMergeItems] = useState<MergeItem[]>([]);
  const [mergeDragging, setMergeDragging] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResult, setMergeResult] = useState<Uint8Array | null>(null);
  const [mergeStatus, setMergeStatus] = useState<"ok" | "err" | null>(null);
  const [mergeMessage, setMergeMessage] = useState("");
  const dragMergeItem = useRef<number | null>(null);

  const addMergeFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list).filter(isPdfFile);
      const bad = Array.from(list).filter((f) => !isPdfFile(f));
      if (bad.length > 0) {
        setMergeStatus("err");
        setMergeMessage(t.errPdfOnly);
      }
      if (files.length === 0) return;
      setMergeItems((prev) => [
        ...prev,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
        })),
      ]);
      setMergeResult(null);
      if (files.length > 0 && bad.length === 0) {
        setMergeStatus(null);
        setMergeMessage("");
      }
    },
    [t.errPdfOnly],
  );

  const removeMergeItem = (id: string) => {
    setMergeItems((prev) => prev.filter((x) => x.id !== id));
    setMergeResult(null);
  };

  const moveMergeItem = (index: number, dir: -1 | 1) => {
    setMergeItems((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setMergeResult(null);
  };

  const runMerge = async () => {
    if (mergeItems.length < 2) {
      setMergeStatus("err");
      setMergeMessage(t.errMergeNeedTwo);
      return;
    }
    setMergeBusy(true);
    setMergeStatus(null);
    setMergeMessage("");
    try {
      const data = await mergePdfFiles(mergeItems.map((m) => m.file));
      setMergeResult(data);
      setMergeStatus("ok");
      setMergeMessage(t.successMerge);
    } catch {
      setMergeResult(null);
      setMergeStatus("err");
      setMergeMessage(t.errMergeFailed);
    } finally {
      setMergeBusy(false);
    }
  };

  // —— Split ——
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitDragging, setSplitDragging] = useState(false);
  const [splitMode, setSplitMode] = useState<"each" | "ranges">("each");
  const [rangesInput, setRangesInput] = useState("");
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitResults, setSplitResults] = useState<
    { filename: string; data: Uint8Array }[] | null
  >(null);
  const [splitStatus, setSplitStatus] = useState<"ok" | "err" | null>(null);
  const [splitMessage, setSplitMessage] = useState("");

  const addSplitFile = (file: File) => {
    if (!isPdfFile(file)) {
      setSplitStatus("err");
      setSplitMessage(t.errPdfOnly);
      return;
    }
    setSplitFile(file);
    setSplitResults(null);
    setSplitStatus(null);
    setSplitMessage("");
  };

  const runSplit = async () => {
    if (!splitFile) {
      setSplitStatus("err");
      setSplitMessage(t.errNoFile);
      return;
    }
    const bytes = new Uint8Array(await splitFile.arrayBuffer());
    setSplitBusy(true);
    setSplitStatus(null);
    setSplitMessage("");
    try {
      let results: { filename: string; data: Uint8Array }[];
      if (splitMode === "each") {
        results = await splitPdfEachPage(bytes, t);
      } else {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const n = doc.getPageCount();
        const parsed = parseRangeInput(rangesInput, n, t);
        if (!parsed.ok) {
          setSplitStatus("err");
          setSplitMessage(parsed.message);
          setSplitBusy(false);
          return;
        }
        results = await splitPdfByGroups(bytes, parsed.groups);
      }
      setSplitResults(results);
      setSplitStatus("ok");
      setSplitMessage(t.successSplit(results.length));
    } catch {
      setSplitResults(null);
      setSplitStatus("err");
      setSplitMessage(t.errSplitFailed);
    } finally {
      setSplitBusy(false);
    }
  };

  const downloadAllSplit = () => {
    if (!splitResults?.length) return;
    splitResults.forEach((r, i) => {
      window.setTimeout(() => downloadUint8Array(r.data, r.filename), i * 250);
    });
  };

  // —— Compress ——
  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressDragging, setCompressDragging] = useState(false);
  const [compressLevel, setCompressLevel] =
    useState<CompressLevel>("balanced");
  const [compressBusy, setCompressBusy] = useState(false);
  const [compressResult, setCompressResult] = useState<Uint8Array | null>(
    null,
  );
  const [compressOriginalSize, setCompressOriginalSize] = useState(0);
  const [compressStatus, setCompressStatus] = useState<"ok" | "err" | null>(
    null,
  );
  const [compressMessage, setCompressMessage] = useState("");

  const addCompressFile = (file: File) => {
    if (!isPdfFile(file)) {
      setCompressStatus("err");
      setCompressMessage(t.errPdfOnly);
      return;
    }
    setCompressFile(file);
    setCompressResult(null);
    setCompressOriginalSize(file.size);
    setCompressStatus(null);
    setCompressMessage("");
  };

  const runCompress = async () => {
    if (!compressFile) {
      setCompressStatus("err");
      setCompressMessage(t.errNoFile);
      return;
    }
    setCompressBusy(true);
    setCompressStatus(null);
    setCompressMessage("");
    try {
      const bytes = new Uint8Array(await compressFile.arrayBuffer());
      setCompressOriginalSize(bytes.length);
      const out = await compressPdfBytes(bytes, compressLevel);
      setCompressResult(out);
      setCompressStatus("ok");
      setCompressMessage(t.successCompress);
    } catch {
      setCompressResult(null);
      setCompressStatus("err");
      setCompressMessage(t.errCompressFailed);
    } finally {
      setCompressBusy(false);
    }
  };

  const reductionPct = useMemo(() => {
    if (!compressResult || compressOriginalSize <= 0) return null;
    const p =
      ((compressOriginalSize - compressResult.length) / compressOriginalSize) *
      100;
    if (p <= 0) return 0;
    return Math.round(p);
  }, [compressResult, compressOriginalSize]);

  const uploadZoneClass =
    "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center transition hover:border-blue-300 hover:bg-blue-50/30";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
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
                <Files className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="hidden font-semibold tracking-tight sm:inline">
                {t.pageTitle}
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t.introLead}</p>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <p className="text-sm leading-relaxed text-slate-600">{t.introSub}</p>
        </div>

        {/* Merge */}
        <section
          className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
          aria-labelledby="pdf-merge-heading"
        >
          <h2
            id="pdf-merge-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <Layers className="h-5 w-5 text-blue-600" strokeWidth={2} />
            {t.mergeTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t.mergeHelp}</p>

          <input
            id={mergeInputId}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addMergeFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={mergeInputId}
            className={`${uploadZoneClass} mt-4 ${mergeDragging ? "border-blue-400 bg-blue-50/50" : ""}`}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setMergeDragging(true);
            }}
            onDragLeave={() => setMergeDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setMergeDragging(false);
              if (e.dataTransfer.files) addMergeFiles(e.dataTransfer.files);
            }}
          >
            <Upload className="mb-2 h-8 w-8 text-blue-500" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-slate-800">
              {mergeDragging ? t.dropHere : t.uploadPrompt}
            </span>
            <span className="mt-1 text-xs text-slate-500">{t.uploadHint}</span>
          </label>

          {mergeItems.length > 0 ? (
            <ul className="mt-4 space-y-2" aria-label={t.filesSelected}>
              {mergeItems.map((item, index) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={() => {
                    dragMergeItem.current = index;
                  }}
                  onDragOver={(e: DragEvent) => e.preventDefault()}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    const from = dragMergeItem.current;
                    dragMergeItem.current = null;
                    if (from === null || from === index) return;
                    setMergeItems((prev) => {
                      const next = [...prev];
                      const [row] = next.splice(from, 1);
                      next.splice(index, 0, row);
                      return next;
                    });
                    setMergeResult(null);
                  }}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2 sm:flex-nowrap"
                >
                  <span
                    className="cursor-grab text-slate-400 active:cursor-grabbing"
                    aria-hidden
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {item.file.name}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {formatBytes(item.file.size)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                      aria-label={t.moveUp}
                      onClick={() => moveMergeItem(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                      aria-label={t.moveDown}
                      onClick={() => moveMergeItem(index, 1)}
                      disabled={index === mergeItems.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={t.removeFile}
                      onClick={() => removeMergeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={runMerge}
              disabled={mergeBusy || mergeItems.length < 2}
            >
              {mergeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {mergeBusy ? t.merging : t.merge}
            </button>
            {mergeResult ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() =>
                    downloadUint8Array(mergeResult, t.mergedFilename)
                  }
                >
                  <Download className="h-4 w-4" />
                  {t.downloadMerged}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setMergeResult(null);
                    setMergeStatus(null);
                    setMergeMessage("");
                  }}
                >
                  {t.clearResult}
                </button>
              </>
            ) : null}
          </div>

          {mergeStatus ? (
            <p
              className={`mt-3 text-sm font-medium ${mergeStatus === "ok" ? "text-emerald-700" : "text-red-600"}`}
              role="status"
            >
              {mergeMessage}
            </p>
          ) : null}
        </section>

        {/* Split */}
        <section
          className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
          aria-labelledby="pdf-split-heading"
        >
          <h2
            id="pdf-split-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <Scissors className="h-5 w-5 text-blue-600" strokeWidth={2} />
            {t.splitTitle}
          </h2>

          <input
            id={splitInputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addSplitFile(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={splitInputId}
            className={`${uploadZoneClass} mt-4 ${splitDragging ? "border-blue-400 bg-blue-50/50" : ""}`}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setSplitDragging(true);
            }}
            onDragLeave={() => setSplitDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setSplitDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) addSplitFile(f);
            }}
          >
            <Upload className="mb-2 h-8 w-8 text-blue-500" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-slate-800">
              {splitDragging ? t.dropHere : t.uploadPrompt}
            </span>
            {splitFile ? (
              <span className="mt-2 text-xs text-slate-600">
                {splitFile.name} · {formatBytes(splitFile.size)}
              </span>
            ) : (
              <span className="mt-1 text-xs text-slate-500">{t.uploadHint}</span>
            )}
          </label>

          {splitFile ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              onClick={() => {
                setSplitFile(null);
                setSplitResults(null);
                setSplitStatus(null);
              }}
            >
              {t.removeFile}
            </button>
          ) : null}

          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">{t.splitTitle}</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="radio"
                name="splitMode"
                checked={splitMode === "each"}
                onChange={() => setSplitMode("each")}
                className="h-4 w-4 border-slate-300 text-blue-600"
              />
              {t.splitModeEach}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="radio"
                name="splitMode"
                checked={splitMode === "ranges"}
                onChange={() => setSplitMode("ranges")}
                className="h-4 w-4 border-slate-300 text-blue-600"
              />
              {t.splitModeRanges}
            </label>
          </fieldset>

          {splitMode === "ranges" ? (
            <div className="mt-3">
              <label
                htmlFor="pdf-ranges-input"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {t.rangesLabel}
              </label>
              <input
                id="pdf-ranges-input"
                type="text"
                value={rangesInput}
                onChange={(e) => setRangesInput(e.target.value)}
                placeholder={t.rangesPlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">{t.rangesHelp}</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={runSplit}
              disabled={splitBusy || !splitFile}
            >
              {splitBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {splitBusy ? t.splitting : t.split}
            </button>
            {splitResults && splitResults.length > 1 ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                onClick={downloadAllSplit}
              >
                <Download className="h-4 w-4" />
                {t.downloadAllSplit}
              </button>
            ) : null}
          </div>

          {splitResults?.length ? (
            <ul className="mt-4 space-y-2" role="list">
              {splitResults.map((r) => (
                <li
                  key={r.filename}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {r.filename}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatBytes(r.data.length)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    onClick={() => downloadUint8Array(r.data, r.filename)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t.downloadSplit(r.filename)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {splitStatus ? (
            <p
              className={`mt-3 text-sm font-medium ${splitStatus === "ok" ? "text-emerald-700" : "text-red-600"}`}
              role="status"
            >
              {splitMessage}
            </p>
          ) : null}
        </section>

        {/* Compress */}
        <section
          className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
          aria-labelledby="pdf-compress-heading"
        >
          <h2
            id="pdf-compress-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <Minimize2 className="h-5 w-5 text-blue-600" strokeWidth={2} />
            {t.compressTitle}
          </h2>

          <input
            id={compressInputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addCompressFile(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={compressInputId}
            className={`${uploadZoneClass} mt-4 ${compressDragging ? "border-blue-400 bg-blue-50/50" : ""}`}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setCompressDragging(true);
            }}
            onDragLeave={() => setCompressDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setCompressDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) addCompressFile(f);
            }}
          >
            <Upload className="mb-2 h-8 w-8 text-blue-500" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-slate-800">
              {compressDragging ? t.dropHere : t.uploadPrompt}
            </span>
            {compressFile ? (
              <span className="mt-2 text-xs text-slate-600">
                {compressFile.name} ·{" "}
                {formatBytes(compressFile.size)}
              </span>
            ) : (
              <span className="mt-1 text-xs text-slate-500">{t.uploadHint}</span>
            )}
          </label>

          {compressFile ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              onClick={() => {
                setCompressFile(null);
                setCompressResult(null);
                setCompressStatus(null);
                setCompressOriginalSize(0);
              }}
            >
              {t.removeFile}
            </button>
          ) : null}

          <fieldset className="mt-4 space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.compressTitle}
            </legend>
            {(
              [
                ["low", t.compressLevelLow, t.compressLevelLowDesc],
                ["balanced", t.compressLevelBalanced, t.compressLevelBalancedDesc],
                ["high", t.compressLevelHigh, t.compressLevelHighDesc],
              ] as const
            ).map(([key, label, desc]) => (
              <label
                key={key}
                className="flex cursor-pointer gap-3 rounded-xl border border-slate-200/80 bg-slate-50/30 p-3 hover:bg-slate-50/60"
              >
                <input
                  type="radio"
                  name="compressLevel"
                  checked={compressLevel === key}
                  onChange={() => setCompressLevel(key)}
                  className="mt-1 h-4 w-4 border-slate-300 text-blue-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {desc}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={runCompress}
              disabled={compressBusy || !compressFile}
            >
              {compressBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {compressBusy ? t.compressing : t.compress}
            </button>
            {compressResult ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() =>
                    downloadUint8Array(compressResult, t.compressedFilename)
                  }
                >
                  <Download className="h-4 w-4" />
                  {t.downloadCompressed}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setCompressResult(null);
                    setCompressStatus(null);
                    setCompressMessage("");
                  }}
                >
                  {t.clearResult}
                </button>
              </>
            ) : null}
          </div>

          {compressResult ? (
            <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.originalSize}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                  {formatBytes(compressOriginalSize)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.newSize}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                  {formatBytes(compressResult.length)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.reduction}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                  {reductionPct !== null ? `${reductionPct}%` : "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{t.compressNoteTitle}</p>
            <p className="mt-1 leading-relaxed text-amber-900/90">
              {t.compressNoteBody}
            </p>
          </div>

          {compressStatus ? (
            <p
              className={`mt-3 text-sm font-medium ${compressStatus === "ok" ? "text-emerald-700" : "text-red-600"}`}
              role="status"
            >
              {compressMessage}
            </p>
          ) : null}
        </section>

        {/* Word → PDF */}
        <section
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
          aria-labelledby="pdf-word-heading"
        >
          <h2
            id="pdf-word-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <FileText className="h-5 w-5 text-blue-600" strokeWidth={2} />
            {t.wordTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t.wordDesc}</p>

          {wordExportHtml ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.wordPreview}
              </p>
              <div className="mt-2 max-h-[min(70vh,560px)] overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div
                  ref={wordExportRef}
                  className="mx-auto bg-white"
                  style={{
                    width: WORD_EXPORT_BODY_WIDTH,
                    minWidth: WORD_EXPORT_BODY_WIDTH,
                    boxSizing: "border-box",
                    padding: 0,
                    paddingBottom: WORD_EXPORT_ROOT_PADDING_BOTTOM_PX,
                    minHeight: 8,
                    color: "#1a1a1a",
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontFamily: WORD_PAGE_FONT,
                    overflow: "visible",
                  }}
                >
                  <style>{WORD_EXPORT_INNER_CSS}</style>
                  <div
                    className="pdf-toolkit-word-html-inner"
                    dangerouslySetInnerHTML={{ __html: wordExportHtml }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <input
            id={wordInputId}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={wordBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addWordFile(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={wordInputId}
            className={`${uploadZoneClass} mt-4 ${wordDragging ? "border-blue-400 bg-blue-50/50" : ""} ${wordBusy ? "pointer-events-none cursor-not-allowed opacity-60" : ""}`}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              if (!wordBusy) setWordDragging(true);
            }}
            onDragLeave={() => setWordDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setWordDragging(false);
              if (wordBusy) return;
              const f = e.dataTransfer.files[0];
              if (f) addWordFile(f);
            }}
          >
            <Upload className="mb-2 h-8 w-8 text-blue-500" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-slate-800">
              {wordDragging ? t.wordDropHere : t.wordUploadPrompt}
            </span>
            {wordFile ? (
              <span className="mt-2 text-xs text-slate-600">
                {wordFile.name} · {formatBytes(wordFile.size)}
              </span>
            ) : (
              <span className="mt-1 text-xs text-slate-500">{t.wordUploadHint}</span>
            )}
          </label>

          {wordFile ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              disabled={wordBusy}
              onClick={() => {
                setWordFile(null);
                setWordExportHtml(null);
                setWordResult(null);
                setWordPdfName("");
                setWordStatus(null);
                setWordMessage("");
              }}
            >
              {t.removeFile}
            </button>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={runWordConvert}
              disabled={wordBusy || !wordFile}
            >
              {wordBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {wordBusy ? t.wordConverting : t.wordConvert}
            </button>
            {wordResult && wordPdfName ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() =>
                    downloadUint8Array(wordResult, wordPdfName)
                  }
                >
                  <Download className="h-4 w-4" />
                  {t.wordDownload}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setWordExportHtml(null);
                    setWordResult(null);
                    setWordPdfName("");
                    setWordStatus(null);
                    setWordMessage("");
                  }}
                >
                  {t.clearResult}
                </button>
              </>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-slate-800">
            <p className="leading-relaxed">{t.wordHelperNote}</p>
          </div>

          {wordStatus ? (
            <p
              className={`mt-3 text-sm font-medium ${wordStatus === "ok" ? "text-emerald-700" : "text-red-600"}`}
              role="status"
            >
              {wordMessage}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
