import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Calculator,
  CalendarClock,
  Clock,
  Files,
  Globe2,
  GraduationCap,
  Heart,
  LayoutGrid,
  Menu,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import {
  formatStudyDuration,
  getWeeklyCompletedFocusMinutesFromStorage,
  STUDY_TIMER_STORAGE_KEY,
  STUDY_TIMER_UPDATED_EVENT,
} from "./studyTimerStats";
import { HubAuthNav } from "./components/HubAuthNav";
import { useHubUiLang } from "./context/HubUiLangContext";

type Lang = "en" | "zh";

type Category = "All" | "Study" | "Productivity" | "Utilities" | "International";

type ToolId =
  | "gpa"
  | "deadline"
  | "timezone"
  | "pdf"
  | "timer"
  | "organizer";

type TranslationTree = {
  brand: string;
  nav: { home: string; tools: string; about: string };
  lang: { en: string; zh: string };
  a11y: { mainNav: string; menuToggle: string; categories: string };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
  };
  heroCards: {
    gpa: { title: string; sub: string };
    deadlines: { title: string; sub: string };
    focus: { title: string; sub: string };
  };
  categories: Record<Category, string>;
  toolsSection: {
    browseBy: string;
    title: string;
    subtitle: string;
  };
  tools: Record<
    ToolId,
    {
      name: string;
      description: string;
    }
  >;
  value: {
    eyebrow: string;
    title: string;
    saveTime: { title: string; description: string };
    stayOrganized: { title: string; description: string };
    reduceStress: { title: string; description: string };
    closing: string;
  };
  footer: {
    blurb: string;
    legal: string;
    connect: string;
    privacy: string;
    contact: string;
    feedback: string;
    rights: string;
  };
  ctaOpenTool: string;
  /** Weekly focus line; use "{X}" once for formatted duration */
  weekMotivationWithX: string;
  weekMotivationEmpty: string;
};

const translations: Record<Lang, TranslationTree> = {
  en: {
    brand: "Student Tools Hub",
    nav: { home: "Home", tools: "Tools", about: "About" },
    lang: { en: "EN", zh: "中文" },
    a11y: {
      mainNav: "Main",
      menuToggle: "Toggle menu",
      categories: "Tool categories",
    },
    hero: {
      badge: "Built for international students",
      title: "One place to solve students’ everyday problems",
      subtitle:
        "A smart toolkit for international school students to study, plan, and live more efficiently.",
      ctaPrimary: "Explore Tools",
    },
    heroCards: {
      gpa: { title: "GPA", sub: "Study" },
      deadlines: { title: "Deadlines", sub: "Plan" },
      focus: { title: "Focus", sub: "Timer" },
    },
    categories: {
      All: "All",
      Study: "Study",
      Productivity: "Productivity",
      Utilities: "Utilities",
      International: "International",
    },
    toolsSection: {
      browseBy: "Browse by category",
      title: "Everything you need in one hub",
      subtitle:
        "Pick a tool, stay in flow—no tab overload, no guesswork.",
    },
    tools: {
      gpa: {
        name: "GPA Calculator",
        description:
          "Calculate semester GPA and predict academic performance",
      },
      deadline: {
        name: "Deadline Tracker",
        description:
          "Track assignments, exams, and application deadlines in one place",
      },
      timezone: {
        name: "Time Zone Converter",
        description:
          "Quickly compare time across countries for meetings and classes",
      },
      pdf: {
        name: "PDF Toolkit",
        description:
          "Merge, split, and compress PDF files for school submissions",
      },
      timer: {
        name: "Study Timer",
        description:
          "Pomodoro timer with focus statistics to reduce procrastination",
      },
      organizer: {
        name: "Study Organizer",
        description:
          "Organize your notes, links, and study files by subject.",
      },
    },
    value: {
      eyebrow: "Why Students Need This",
      title: "Built for how students actually work",
      saveTime: {
        title: "Save Time",
        description:
          "Jump straight into the task with tools that open fast and stay focused on outcomes.",
      },
      stayOrganized: {
        title: "Stay Organized",
        description:
          "Deadlines, files, and study blocks live together so nothing slips through the cracks.",
      },
      reduceStress: {
        title: "Reduce Stress",
        description:
          "Clear layouts and gentle guidance help you plan without the mental overhead.",
      },
      closing:
        "More tools shipping soon—GPA, PDF, and focus workflows in one place.",
    },
    footer: {
      blurb:
        "A calm, student-first workspace for grades, deadlines, time zones, and daily study—without the clutter.",
      legal: "Legal",
      connect: "Connect",
      privacy: "Privacy",
      contact: "Contact",
      feedback: "Feedback",
      rights: "All rights reserved.",
    },
    ctaOpenTool: "Open Tool",
    weekMotivationWithX: "You've focused for {X} this week",
    weekMotivationEmpty: "Start a focus session to build your streak",
  },
  zh: {
    brand: "Student Tools Hub",
    nav: { home: "首页", tools: "工具", about: "关于" },
    lang: { en: "EN", zh: "中文" },
    a11y: {
      mainNav: "主导航",
      menuToggle: "打开菜单",
      categories: "工具分类",
    },
    hero: {
      badge: "面向国际学生",
      title: "一个网站，解决学生的日常小麻烦",
      subtitle:
        "为国际学校学生打造的智能工具箱，让学习、规划和生活更高效。",
      ctaPrimary: "浏览工具",
    },
    heroCards: {
      gpa: { title: "GPA", sub: "学习" },
      deadlines: { title: "截止日", sub: "规划" },
      focus: { title: "专注", sub: "计时" },
    },
    categories: {
      All: "全部",
      Study: "学习",
      Productivity: "效率",
      Utilities: "实用",
      International: "国际",
    },
    toolsSection: {
      browseBy: "按分类浏览",
      title: "一站式工具枢纽",
      subtitle: "选好工具，保持心流——告别标签页大爆炸。",
    },
    tools: {
      gpa: {
        name: "GPA 计算器",
        description: "计算学期 GPA，并预测学业表现",
      },
      deadline: {
        name: "Deadline 截止日追踪",
        description:
          "在一个地方追踪作业、考试和申请截止日期",
      },
      timezone: {
        name: "时区转换器",
        description: "快速比较不同时区时间，方便会议和上课安排",
      },
      pdf: {
        name: "PDF 工具箱",
        description: "合并、拆分和压缩 PDF 文件，方便学校提交作业",
      },
      timer: {
        name: "学习计时器",
        description: "番茄钟结合专注统计，帮助减少拖延",
      },
      organizer: {
        name: "资料整理工具",
        description: "按学科整理你的笔记、链接和学习资料。",
      },
    },
    value: {
      eyebrow: "为什么学生需要它",
      title: "贴合真实学习场景",
      saveTime: {
        title: "节省时间",
        description:
          "打开即可用的工具，帮你快速进入状态、专注结果。",
      },
      stayOrganized: {
        title: "保持有条理",
        description:
          "截止日期、文件和学习安排集中管理，不漏项。",
      },
      reduceStress: {
        title: "减少压力",
        description:
          "清晰界面与轻量引导，减轻规划时的心理负担。",
      },
      closing:
        "更多工具即将上线——GPA、PDF 与专注工作流，一站搞定。",
    },
    footer: {
      blurb:
        "一个以学生为先、安静好用的空间，管理成绩、截止日期、时区与每日学习——告别杂乱。",
      legal: "法律信息",
      connect: "联系",
      privacy: "隐私",
      contact: "联系我们",
      feedback: "反馈",
      rights: "保留所有权利。",
    },
    ctaOpenTool: "打开工具",
    weekMotivationWithX: "你这周已经专注了 {X}",
    weekMotivationEmpty: "开始一次专注，建立你的学习节奏",
  },
};

const CATEGORIES: Category[] = [
  "All",
  "Study",
  "Productivity",
  "Utilities",
  "International",
];

type ToolDef = {
  id: ToolId;
  category: Exclude<Category, "All">;
  icon: LucideIcon;
};

const TOOL_DEFS: ToolDef[] = [
  { id: "gpa", category: "Study", icon: Calculator },
  { id: "deadline", category: "Productivity", icon: CalendarClock },
  { id: "timezone", category: "International", icon: Globe2 },
  { id: "pdf", category: "Utilities", icon: Files },
  { id: "timer", category: "Productivity", icon: Timer },
  { id: "organizer", category: "Study", icon: LayoutGrid },
];

const TOOL_ROUTES: Record<ToolId, string> = {
  gpa: "/tools/gpa",
  deadline: "/tools/deadline",
  timezone: "/tools/timezone",
  pdf: "/tools/pdf",
  timer: "/tools/timer",
  organizer: "/tools/organizer",
};

type LangContextValue = {
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: TranslationTree;
};

const LangContext = createContext<LangContextValue | null>(null);

function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within StudentToolsHubLanding");
  return ctx;
}

function LanguageToggle() {
  const { language, setLanguage, t } = useLang();

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

function Navbar() {
  const { t, language } = useLang();
  const [open, setOpen] = useState(false);

  const links = useMemo(
    () =>
      [
        { href: "#home", label: t.nav.home },
        { href: "#tools", label: t.nav.tools },
        { href: "#about", label: t.nav.about },
      ] as const,
    [t.nav],
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-slate-900"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-soft">
            <GraduationCap className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="truncate">{t.brand}</span>
        </a>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label={t.a11y.mainNav}
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <HubAuthNav lang={language} />

          <LanguageToggle />

          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-slate-700 md:hidden"
            aria-expanded={open}
            aria-label={t.a11y.menuToggle}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroVisual() {
  const { t } = useLang();
  const mini = useMemo(
    () => [
      { key: "gpa" as const, Icon: Calculator },
      { key: "deadlines" as const, Icon: CalendarClock },
      { key: "focus" as const, Icon: Timer },
    ],
    [],
  );

  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      <div
        className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-blue-100/80 via-white to-indigo-50 blur-2xl"
        aria-hidden
      />
      <div className="relative space-y-4">
        {mini.map((item, i) => {
          const card = t.heroCards[item.key];
          const inner = (
            <>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                <item.Icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{card.title}</p>
                <p className="text-sm text-slate-500">{card.sub}</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-slate-300" />
            </>
          );
          const cardClass = `flex animate-float items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur-sm transition-transform duration-300 hover:scale-[1.02] ${i === 1 ? "ml-6 lg:ml-10" : i === 2 ? "ml-2 lg:ml-4" : ""}`;
          return item.key === "focus" ? (
            <Link
              key={item.key}
              to="/tools/timer"
              className={`${cardClass} text-left`}
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={item.key}
              className={cardClass}
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useLang();

  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {t.hero.badge}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            {t.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            {t.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#tools"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700 hover:shadow-lift"
            >
              {t.hero.ctaPrimary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function CategoryFilter({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <p className="mb-4 text-center text-sm font-medium text-slate-500">
        {t.toolsSection.browseBy}
      </p>
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="tablist"
        aria-label={t.a11y.categories}
      >
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(cat)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.categories[cat]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDef }) {
  const { t } = useLang();
  const Icon = tool.icon;
  const copy = t.tools[tool.id];

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-200 hover:shadow-lift">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 text-blue-600 ring-1 ring-slate-100 transition group-hover:scale-105 group-hover:from-blue-50 group-hover:to-indigo-50">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {t.categories[tool.category]}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{copy.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
        {copy.description}
      </p>
      <Link
        to={TOOL_ROUTES[tool.id]}
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {t.ctaOpenTool}
      </Link>
    </article>
  );
}

function ToolsSectionWithState() {
  const { t } = useLang();
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const visible =
    activeCategory === "All"
      ? TOOL_DEFS
      : TOOL_DEFS.filter((x) => x.category === activeCategory);

  return (
    <section id="tools" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.toolsSection.title}
          </h2>
          <p className="mt-4 text-slate-600">{t.toolsSection.subtitle}</p>
        </div>

        <div className="mt-10">
          <CategoryFilter
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ValueProposition() {
  const { t } = useLang();
  const items = useMemo(
    () => [
      { key: "saveTime" as const, icon: Clock },
      { key: "stayOrganized" as const, icon: LayoutGrid },
      { key: "reduceStress" as const, icon: Heart },
    ],
    [],
  );

  return (
    <section id="about" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            {t.value.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.value.title}
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            const block = t.value[item.key];
            return (
              <div
                key={item.key}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8 text-center shadow-sm transition hover:border-blue-100 hover:bg-white hover:shadow-soft"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-100">
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">
                  {block.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {block.description}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            {t.value.closing}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-soft">
                <GraduationCap className="h-5 w-5" strokeWidth={2} />
              </span>
              {t.brand}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {t.footer.blurb}
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{t.footer.legal}</p>
              <ul className="mt-3 space-y-2 text-slate-600">
                <li>
                  <a href="#privacy" className="hover:text-blue-600">
                    {t.footer.privacy}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">{t.footer.connect}</p>
              <ul className="mt-3 space-y-2 text-slate-600">
                <li>
                  <a href="#contact" className="hover:text-blue-600">
                    {t.footer.contact}
                  </a>
                </li>
                <li>
                  <a href="#feedback" className="hover:text-blue-600">
                    {t.footer.feedback}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
          © {year} {t.brand}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function WeeklyFocusMotivationStrip() {
  const { language, t } = useLang();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const bump = () => setRefresh((x) => x + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STUDY_TIMER_STORAGE_KEY) bump();
    };
    const onTimerUpdated = () => bump();
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    const id = window.setInterval(bump, 60_000);
    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_TIMER_UPDATED_EVENT, onTimerUpdated);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STUDY_TIMER_UPDATED_EVENT, onTimerUpdated);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const minutesWeek = useMemo(
    () => getWeeklyCompletedFocusMinutesFromStorage(),
    [refresh],
  );

  return (
    <div className="border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-white px-4 py-3 text-center sm:px-6">
      {minutesWeek < 1 / 60 ? (
        <p className="text-sm leading-relaxed text-slate-500" role="status">
          {t.weekMotivationEmpty}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600" role="status">
          {t.weekMotivationWithX.split("{X}").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 ? (
                <span className="font-semibold text-slate-800">
                  {formatStudyDuration(minutesWeek, language)}
                </span>
              ) : null}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * Main export: full landing page for Student Tools Hub.
 * All sections and subcomponents live in this file per project requirements.
 */
export function StudentToolsHubLanding() {
  const { language, setLanguage } = useHubUiLang();

  const t = translations[language];

  const ctx = useMemo<LangContextValue>(
    () => ({
      language: language as Lang,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return (
    <LangContext.Provider value={ctx}>
      <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        <Navbar />
        <WeeklyFocusMotivationStrip />
        <main>
          <Hero />
          <ToolsSectionWithState />
          <ValueProposition />
        </main>
        <Footer />
      </div>
    </LangContext.Provider>
  );
}
