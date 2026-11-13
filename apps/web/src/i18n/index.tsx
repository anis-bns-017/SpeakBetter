// apps/web/src/i18n/index.tsx
/**
 * The interface language (English or Bangla). No library: the English text is the key, Bangla comes from
 * i18n/bn.ts, and anything not translated yet simply stays in English, so screens can be translated one at a time.
 *
 *   const { t, lang, setLang } = useT();
 *   t("Good morning, {name}", { name })
 *
 * The choice is kept on this device and in the account (Settings.language), so it follows the person to other
 * devices. Bangla also loads a Bengali font (Hind Siliguri) and sets <html lang="bn">.
 */

import React, { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bn } from "./bn";
import { FONT_ID, STORAGE_KEY, fill, isLang, setCurrentLang, type Lang, type Vars } from "./core";
import { apiClient } from "../lib/api/client";
import { useAuth } from "../contexts/useAuth";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (text: string, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (text, vars) => fill(text, vars),
});

const readStored = (): Lang | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
};

/** Puts the language on the page: <html lang>, and the Bengali font only when it's needed */
function applyToPage(lang: Lang) {
  document.documentElement.lang = lang;
  if (lang === "bn" && !document.getElementById(FONT_ID)) {
    const link = document.createElement("link");
    link.id = FONT_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(() => {
    const first = readStored() ?? "en";
    setCurrentLang(first);
    return first;
  });

  useEffect(() => applyToPage(lang), [lang]);

  // Signed in on a device with no choice saved yet: use the account's language
  useEffect(() => {
    if (!user || readStored()) return;
    let live = true;
    apiClient
      .get<{ language?: string }>("/settings")
      .then((r) => {
        if (live && isLang(r.data?.language) && r.data.language !== "en") {
          setCurrentLang(r.data.language);
          setLangState(r.data.language);
          try {
            localStorage.setItem(STORAGE_KEY, r.data.language);
          } catch {
            /* fine */
          }
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user]);

  const setLang = useCallback(
    (next: Lang) => {
      setCurrentLang(next);
      setLangState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* the account still remembers it */
      }
      if (user) void apiClient.put("/settings", { language: next }).catch(() => undefined);
    },
    [user],
  );

  const t = useCallback((text: string, vars?: Vars) => fill(lang === "bn" ? (bn[text] ?? text) : text, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  // Keyed by language: switching redraws every screen, including text translated with tr() outside hooks
  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useT = () => useContext(LanguageContext);
