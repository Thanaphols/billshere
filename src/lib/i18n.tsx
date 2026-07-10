"use client";

import React, { createContext, useContext } from "react";
import { translations, t, type Lang, type TranslationKey } from "./i18n-dict";

export { translations, t };
export type { Lang, TranslationKey };

const I18nContext = createContext<{
  lang: Lang;
  t: (key: TranslationKey) => string;
}>({
  lang: "th",
  t: (key) => translations.th[key] || String(key),
});

export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const translate = (key: TranslationKey) => t(key, lang);

  return (
    <I18nContext.Provider value={{ lang, t: translate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
