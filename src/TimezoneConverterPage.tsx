import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { HubAuthNav } from "./components/HubAuthNav";
import { ArrowLeft, Clock, Globe2, Trash2 } from "lucide-react";
import { DateTime } from "luxon";

// —— Types ————————————————————————————————————————————————————————

export type TzLang = "en" | "zh";

export type TzIana = (typeof TZ_PRESETS)[number]["iana"];

export type DayRelation = "same" | "next" | "prev";

type Translations = {
  lang: { en: string; zh: string };
  backToHub: string;
  pageTitle: string;
  pageSubtitle: string;
  baseCardHeading: string;
  baseDate: string;
  baseTime: string;
  baseZone: string;
  addTimeZone: string;
  comparisonZones: string;
  remove: string;
  sameDay: string;
  nextDay: string;
  prevDay: string;
  quickAdd: string;
  emptyComparisons: string;
  timeDifference: string;
  convertedTime: string;
  diffSame: string;
  diffAhead: string;
  diffBehind: string;
  addHint: string;
  tzSearchPlaceholder: string;
  tzNoMatch: string;
};

const translations: Record<TzLang, Translations> = {
  en: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "Back to hub",
    pageTitle: "Time Zone Converter",
    pageSubtitle:
      "Compare local times for classes, meetings, interviews, and deadlines across regions.",
    baseCardHeading: "Base date & time",
    baseDate: "Base Date",
    baseTime: "Base Time",
    baseZone: "Base Time Zone",
    addTimeZone: "Add Time Zone",
    comparisonZones: "Comparison Time Zones",
    remove: "Remove",
    sameDay: "Same day",
    nextDay: "Next day",
    prevDay: "Previous day",
    quickAdd: "Quick Add",
    emptyComparisons: "No comparison time zones yet",
    timeDifference: "Time Difference",
    convertedTime: "Local time",
    diffSame: "Same offset as base",
    diffAhead: "ahead of base",
    diffBehind: "behind base",
    addHint: "Search to add any IANA zone, or use quick-add chips.",
    tzSearchPlaceholder: "Search time zone...",
    tzNoMatch: "No matching time zones",
  },
  zh: {
    lang: { en: "EN", zh: "中文" },
    backToHub: "返回首页",
    pageTitle: "时区转换器",
    pageSubtitle: "对比不同地区的本地时间，方便上课、会议、面试与截止日安排。",
    baseCardHeading: "基准日期与时间",
    baseDate: "基准日期",
    baseTime: "基准时间",
    baseZone: "基准时区",
    addTimeZone: "添加时区",
    comparisonZones: "对比时区",
    remove: "删除",
    sameDay: "同一天",
    nextDay: "次日",
    prevDay: "前一天",
    quickAdd: "快速添加",
    emptyComparisons: "暂无对比时区",
    timeDifference: "时差",
    convertedTime: "当地时间",
    diffSame: "与基准时区相同偏移",
    diffAhead: "比基准早",
    diffBehind: "比基准晚",
    addHint: "搜索添加任意 IANA 时区，或使用上方快速添加。",
    tzSearchPlaceholder: "搜索时区...",
    tzNoMatch: "没有匹配的时区",
  },
};

export const TIMEZONE_STORAGE_KEY = "student-tools-timezone-converter";

/** Wall-clock refresh for live base / comparison times (1 Hz keeps UI responsive without rAF spam). */
const LIVE_CLOCK_TICK_MS = 1_000;

/** Built-in zones with friendly labels (EN / 中文). */
export const TZ_PRESETS = [
  { iana: "Asia/Tokyo" as const, labelEn: "Tokyo", labelZh: "东京" },
  { iana: "Asia/Shanghai" as const, labelEn: "Beijing", labelZh: "北京" },
  { iana: "Asia/Singapore" as const, labelEn: "Singapore", labelZh: "新加坡" },
  { iana: "Europe/London" as const, labelEn: "London", labelZh: "伦敦" },
  { iana: "America/New_York" as const, labelEn: "New York", labelZh: "纽约" },
  {
    iana: "America/Los_Angeles" as const,
    labelEn: "Los Angeles",
    labelZh: "洛杉矶",
  },
  { iana: "Europe/Paris" as const, labelEn: "Paris", labelZh: "巴黎" },
  {
    iana: "Australia/Sydney" as const,
    labelEn: "Sydney",
    labelZh: "悉尼",
  },
] as const;

const PRESET_IANAS = new Set<string>(TZ_PRESETS.map((p) => p.iana));

/**
 * When `Intl.supportedValuesOf("timeZone")` is unavailable (older runtimes).
 * Covers major regions; sorted at runtime with any Intl-provided zones.
 */
const FALLBACK_IANA_TIMEZONES: readonly string[] = [
  "Africa/Abidjan",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Almaty",
  "Asia/Baghdad",
  "Asia/Bangkok",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tbilisi",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Ulaanbaatar",
  "Asia/Yangon",
  "Atlantic/Azores",
  "Atlantic/Reykjavik",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kyiv",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Port_Moresby",
  "US/Hawaii",
];

let cachedAllZones: string[] | null = null;

export function getAllIanaTimeZones(): string[] {
  if (cachedAllZones) return cachedAllZones;
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    if (typeof fn === "function") {
      const list = fn.call(Intl, "timeZone");
      if (Array.isArray(list) && list.length > 0) {
        cachedAllZones = [...new Set([...list, ...FALLBACK_IANA_TIMEZONES])].sort(
          (a, b) => a.localeCompare(b),
        );
        return cachedAllZones;
      }
    }
  } catch {
    /* ignore */
  }
  cachedAllZones = [...new Set(FALLBACK_IANA_TIMEZONES)].sort((a, b) =>
    a.localeCompare(b),
  );
  return cachedAllZones;
}

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Friendly label from IANA when not in presets (last path segment). */
function ianaToFriendlyFallback(iana: string): string {
  const last = iana.split("/").pop() ?? iana;
  return titleCaseSegment(last.replace(/_/g, " "));
}

export function getTimezoneCityLabel(iana: string, lang: TzLang): string {
  const p = TZ_PRESETS.find((x) => x.iana === iana);
  if (p) return lang === "zh" ? p.labelZh : p.labelEn;
  return ianaToFriendlyFallback(iana);
}

function isValidLuxonZone(iana: string, reference?: DateTime): boolean {
  const at = reference ?? DateTime.now();
  return at.setZone(iana).isValid;
}

/** Often-used zones — small score boost so they surface when relevance is close. */
export const POPULAR_TIMEZONES = [
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Paris",
  "Australia/Sydney",
] as const;

const POPULAR_TIMEZONE_SET = new Set<string>(POPULAR_TIMEZONES);

export type TzSearchOption = { label: string; zone: string };

/** Last path segment of an IANA id (e.g. `America/New_York` → `New_York`). */
export function getZoneLastSegment(zone: string): string {
  return zone.split("/").pop() ?? zone;
}

function timezoneMatchesFilter(
  q: string,
  labelLc: string,
  zoneLc: string,
): boolean {
  return labelLc.includes(q) || zoneLc.includes(q);
}

/**
 * Base relevance tier (lower = better). See `rankTimezoneOption` for final sort key.
 * 0 exact → 1 label prefix → 2 last-segment prefix → 3 word prefix → 4 label contains
 * → 5 IANA contains → 6 fallback.
 */
function rankTimezoneBaseTier(
  q: string,
  labelLc: string,
  zoneLc: string,
  lastSegLc: string,
): number {
  if (labelLc === q || zoneLc === q) return 0;
  if (labelLc.startsWith(q)) return 1;
  if (lastSegLc.startsWith(q)) return 2;
  if (labelLc.split(/[\s/]+/).filter(Boolean).some((w) => w.startsWith(q)))
    return 3;
  if (labelLc.includes(q)) return 4;
  if (zoneLc.includes(q)) return 5;
  return 6;
}

/**
 * Sort key for search (lower = more relevant). Applies popular-zone boost and
 * single-character query nudges so label-prefix matches dominate.
 */
export function rankTimezoneOption(
  query: string,
  option: TzSearchOption,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return Number.POSITIVE_INFINITY;

  const labelLc = option.label.toLowerCase();
  const zoneLc = option.zone.toLowerCase();
  const lastSegLc = getZoneLastSegment(option.zone).toLowerCase();

  if (!timezoneMatchesFilter(q, labelLc, zoneLc)) {
    return Number.POSITIVE_INFINITY;
  }

  const base = rankTimezoneBaseTier(q, labelLc, zoneLc, lastSegLc);

  let score = base;
  if (POPULAR_TIMEZONE_SET.has(option.zone)) {
    score = Math.max(0, score - 0.5);
  }
  if (q.length === 1 && base > 1) {
    score += 0.5;
  }
  return score;
}

export function filterTimezonesForSearch(
  query: string,
  zones: readonly string[],
  lang: TzLang,
  exclude: ReadonlySet<string>,
): TzSearchOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  type Row = TzSearchOption & { rank: number };
  const rows: Row[] = [];

  for (const zone of zones) {
    if (exclude.has(zone)) continue;
    const label = getTimezoneCityLabel(zone, lang);
    const option: TzSearchOption = { label, zone };
    const rank = rankTimezoneOption(query, option);
    if (!Number.isFinite(rank)) continue;
    rows.push({ ...option, rank });
  }

  rows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      a.zone.localeCompare(b.zone)
    );
  });

  return rows.slice(0, 120).map(({ label, zone }) => ({ label, zone }));
}

function highlightedText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const hay = text.toLowerCase();
  const needle = q.toLowerCase();
  const i = hay.indexOf(needle);
  if (i < 0) return text;
  const j = i + needle.length;
  return (
    <>
      {text.slice(0, i)}
      <span className="rounded-sm bg-blue-100/70 px-0.5 text-inherit">
        {text.slice(i, j)}
      </span>
      {text.slice(j)}
    </>
  );
}

function ZoneSearchOptionLine({
  label,
  zone,
  query,
}: {
  label: string;
  zone: string;
  query: string;
}): ReactNode {
  return (
    <>
      {highlightedText(label, query)} ({highlightedText(zone, query)})
    </>
  );
}

function isValidIana(x: string): x is TzIana {
  return PRESET_IANAS.has(x);
}

/** Calendar day relation of `targetZone` local date vs base zone local date for the same instant. */
export function getDayRelation(
  base: DateTime,
  targetZone: string,
): DayRelation {
  const baseDay = base.toFormat("yyyy-MM-dd");
  const targetDay = base.setZone(targetZone).toFormat("yyyy-MM-dd");
  if (targetDay === baseDay) return "same";
  if (targetDay > baseDay) return "next";
  return "prev";
}

export function formatOffsetDelta(
  base: DateTime,
  targetZone: string,
  lang: TzLang,
  t: Translations,
): string {
  const atTarget = base.setZone(targetZone);
  const deltaMin = atTarget.offset - base.offset;
  if (deltaMin === 0) return t.diffSame;
  const ahead = deltaMin > 0;
  const abs = Math.abs(deltaMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const dur =
    lang === "zh"
      ? m > 0
        ? `${h} 小时 ${m} 分`
        : `${h} 小时`
      : m > 0
        ? `${h}h ${m}m`
        : `${h}h`;
  if (lang === "zh") {
    return ahead ? `${t.diffAhead} ${dur}` : `${t.diffBehind} ${dur}`;
  }
  return ahead ? `${dur} ${t.diffAhead}` : `${dur} ${t.diffBehind}`;
}

function dayRelationLabel(rel: DayRelation, t: Translations): string {
  switch (rel) {
    case "same":
      return t.sameDay;
    case "next":
      return t.nextDay;
    case "prev":
      return t.prevDay;
  }
}

function formatLocalDateTime(dt: DateTime, lang: TzLang): string {
  return dt
    .setLocale(lang === "zh" ? "zh-CN" : "en-US")
    .toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
}

type PersistedTimezoneState = {
  language: TzLang;
  baseZone: TzIana;
  comparisonZones: string[];
};

function loadPersistedState(): PersistedTimezoneState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const language = o.language === "zh" || o.language === "en" ? o.language : "en";
    const baseZone =
      typeof o.baseZone === "string" && isValidIana(o.baseZone)
        ? o.baseZone
        : null;
    if (!baseZone) return null;
    const comparisonZones: string[] = [];
    if (Array.isArray(o.comparisonZones)) {
      for (const z of o.comparisonZones) {
        if (typeof z !== "string" || !isValidLuxonZone(z)) continue;
        if (z === baseZone) continue;
        if (!comparisonZones.includes(z)) comparisonZones.push(z);
      }
    }
    return { language, baseZone, comparisonZones };
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedTimezoneState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function TimezoneSearchAdd({
  allZones,
  language,
  baseZone,
  comparisonZones,
  onAdd,
  t,
}: {
  allZones: readonly string[];
  language: TzLang;
  baseZone: string;
  comparisonZones: readonly string[];
  onAdd: (iana: string) => void;
  t: Translations;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const excluded = useMemo(
    () => new Set<string>([baseZone, ...comparisonZones]),
    [baseZone, comparisonZones],
  );

  const filtered = useMemo(
    () => filterTimezonesForSearch(query, allZones, language, excluded),
    [query, allZones, language, excluded],
  );

  const hasQuery = query.trim().length > 0;
  const showPanel = open && hasQuery;
  const hasMatches = filtered.length > 0;
  const flatKey = filtered.map((o) => o.zone).join("\0");

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [flatKey]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const pick = useCallback(
    (iana: string) => {
      onAdd(iana);
      setQuery("");
      closePanel();
    },
    [onAdd, closePanel],
  );

  useEffect(() => {
    if (!showPanel || highlightedIndex < 0 || !hasMatches) return;
    document
      .getElementById(`${listId}-opt-${highlightedIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, showPanel, listId, hasMatches]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, closePanel]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        closePanel();
      }
      return;
    }

    if (!showPanel || !hasMatches) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i < 0 ? 0 : (i + 1) % filtered.length,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i < 0
          ? filtered.length - 1
          : (i - 1 + filtered.length) % filtered.length,
      );
      return;
    }

    if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        pick(filtered[highlightedIndex].zone);
      }
    }
  };

  const rowClass = (active: boolean) =>
    `w-full px-3 py-2 text-left text-sm font-medium transition ${
      active
        ? "bg-blue-50 text-blue-950"
        : "text-slate-800 hover:bg-slate-50"
    }`;

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t.addTimeZone}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t.tzSearchPlaceholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={`${listId}-listbox`}
        aria-activedescendant={
          showPanel && hasMatches && highlightedIndex >= 0
            ? `${listId}-opt-${highlightedIndex}`
            : undefined
        }
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
      />
      {showPanel ? (
        <div
          id={`${listId}-listbox`}
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100"
          role="listbox"
        >
          {!hasMatches ? (
            <p
              className="px-3 py-4 text-center text-sm font-medium text-slate-500"
              role="status"
            >
              {t.tzNoMatch}
            </p>
          ) : (
            <ul className="py-1">
              {filtered.map((opt, i) => (
                <li key={opt.zone} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={highlightedIndex === i}
                    className={rowClass(highlightedIndex === i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onClick={() => pick(opt.zone)}
                  >
                    <ZoneSearchOptionLine
                      label={opt.label}
                      zone={opt.zone}
                      query={query}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// —— UI ————————————————————————————————————————————————————————————

function LanguageToggle({
  language,
  setLanguage,
  t,
}: {
  language: TzLang;
  setLanguage: (l: TzLang) => void;
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

function PageHeader({
  t,
  language,
  setLanguage,
}: {
  t: Translations;
  language: TzLang;
  setLanguage: (l: TzLang) => void;
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
              <Globe2 className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              {t.pageTitle}
            </span>
          </div>
          <HubAuthNav lang={language} compact />
          <LanguageToggle language={language} setLanguage={setLanguage} t={t} />
        </div>
      </div>
    </header>
  );
}

export function TimezoneConverterPage() {
  const [now, setNow] = useState(() => DateTime.now());

  useEffect(() => {
    const tick = () => setNow(DateTime.now());
    tick();
    const id = window.setInterval(tick, LIVE_CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const initial = useMemo(() => {
    const loaded = loadPersistedState();
    if (loaded) return loaded;
    return {
      language: "en" as TzLang,
      baseZone: "Asia/Shanghai" as TzIana,
      comparisonZones: [] as string[],
    };
  }, []);

  const [language, setLanguage] = useState<TzLang>(initial.language);
  const [baseZone, setBaseZone] = useState<TzIana>(initial.baseZone);
  const [comparisonZones, setComparisonZones] = useState<string[]>(
    initial.comparisonZones,
  );

  const t = translations[language];
  const allZones = useMemo(() => getAllIanaTimeZones(), []);

  useEffect(() => {
    savePersistedState({ language, baseZone, comparisonZones });
  }, [language, baseZone, comparisonZones]);

  useEffect(() => {
    setComparisonZones((prev) => prev.filter((z) => z !== baseZone));
  }, [baseZone]);

  /** Single live reference instant expressed in the base IANA zone. */
  const baseDt = useMemo(() => now.setZone(baseZone), [now, baseZone]);
  const baseDateValue = baseDt.toFormat("yyyy-MM-dd");
  const baseTimeValue = baseDt.toFormat("HH:mm:ss");

  const baseInvalid = !baseDt.isValid;

  const nowRef = useRef(now);
  nowRef.current = now;

  const addComparison = useCallback(
    (z: string) => {
      if (z === baseZone || !isValidLuxonZone(z, nowRef.current)) return;
      setComparisonZones((prev) =>
        prev.includes(z) ? prev : [...prev, z],
      );
    },
    [baseZone],
  );

  const removeComparison = useCallback((z: string) => {
    setComparisonZones((prev) => prev.filter((x) => x !== z));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900 antialiased">
      <PageHeader t={t} language={language} setLanguage={setLanguage} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t.pageSubtitle}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Clock className="h-5 w-5 text-blue-600" strokeWidth={2} />
            {t.baseCardHeading}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.baseDate}
              </label>
              <div
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium tabular-nums text-slate-900"
                aria-live="polite"
              >
                {baseDateValue}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.baseTime}
              </label>
              <div
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium tabular-nums text-slate-900"
                aria-live="polite"
              >
                {baseTimeValue}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.baseZone}
              </label>
              <select
                value={baseZone}
                onChange={(e) => {
                  const z = e.target.value;
                  if (isValidIana(z)) setBaseZone(z);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-blue-500/30 focus:ring-2"
              >
                {TZ_PRESETS.map((p) => (
                  <option key={p.iana} value={p.iana}>
                    {language === "zh" ? p.labelZh : p.labelEn} ({p.iana})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {baseInvalid ? (
            <p className="mt-3 text-sm font-medium text-red-600">
              {language === "zh" ? "日期或时间无效" : "Invalid date or time"}
            </p>
          ) : null}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.quickAdd}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TZ_PRESETS.map((p) => {
              const disabled =
                p.iana === baseZone || comparisonZones.includes(p.iana);
              return (
                <button
                  key={p.iana}
                  type="button"
                  disabled={disabled}
                  onClick={() => addComparison(p.iana)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    disabled
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                  }`}
                >
                  {language === "zh" ? p.labelZh : p.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {t.addTimeZone}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t.addHint}</p>
          <div className="mt-4">
            <TimezoneSearchAdd
              allZones={allZones}
              language={language}
              baseZone={baseZone}
              comparisonZones={comparisonZones}
              onAdd={addComparison}
              t={t}
            />
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {t.comparisonZones}
          </h2>

          {!baseInvalid && comparisonZones.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm font-medium text-slate-500">
              {t.emptyComparisons}
            </p>
          ) : null}

          {!baseInvalid && comparisonZones.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {comparisonZones.map((z) => {
                const local = baseDt.setZone(z);
                const rel = getDayRelation(baseDt, z);
                const diffStr = formatOffsetDelta(baseDt, z, language, t);
                return (
                  <li
                    key={z}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/30 p-4 ring-1 ring-slate-100 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-slate-900">
                          {getTimezoneCityLabel(z, language)}
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {z}
                        </p>
                        <p className="mt-3 text-sm font-medium text-slate-800">
                          <span className="text-slate-500">{t.convertedTime}: </span>
                          {formatLocalDateTime(local, language)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {t.timeDifference}: {diffStr}
                          </span>
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">
                            {dayRelationLabel(rel, t)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComparison(z)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 sm:text-sm"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                        {t.remove}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {baseInvalid && comparisonZones.length > 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              {language === "zh"
                ? "基准时区无效，无法显示对比结果。"
                : "Invalid base time zone; comparisons are unavailable."}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
