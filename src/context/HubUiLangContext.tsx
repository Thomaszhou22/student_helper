import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HubUiLang = "en" | "zh";

export const HUB_UI_LANG_STORAGE_KEY = "student-tools-ui-lang";

function readStoredLang(): HubUiLang {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(HUB_UI_LANG_STORAGE_KEY);
    return raw === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

type HubUiLangContextValue = {
  language: HubUiLang;
  setLanguage: (l: HubUiLang) => void;
};

const HubUiLangContext = createContext<HubUiLangContextValue | null>(null);

export function HubUiLangProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<HubUiLang>(() =>
    readStoredLang(),
  );

  const setLanguage = useCallback((l: HubUiLang) => {
    setLanguageState(l);
    try {
      localStorage.setItem(HUB_UI_LANG_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <HubUiLangContext.Provider value={value}>
      {children}
    </HubUiLangContext.Provider>
  );
}

export function useHubUiLang(): HubUiLangContextValue {
  const ctx = useContext(HubUiLangContext);
  if (!ctx) {
    throw new Error("useHubUiLang must be used within HubUiLangProvider");
  }
  return ctx;
}
