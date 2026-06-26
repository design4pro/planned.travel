import { ui, defaultLang, type Lang, type MessageKey } from "./ui";

/** Detect locale from the first URL path segment (e.g. /pl/... → "pl"). */
export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in ui) return lang as Lang;
  return defaultLang;
}

/** Returns a `t(key)` translator for the given locale. */
export function useTranslations(lang: Lang) {
  return function t(key: MessageKey): string {
    return ui[lang][key] ?? ui[defaultLang][key] ?? String(key);
  };
}

/** Build a path for a target locale (prefixDefaultLocale: false → "en" has no prefix). */
export function localizePath(path: string, lang: Lang): string {
  if (lang === defaultLang) return path === "/" ? "/" : path;
  return `/${lang}${path === "/" ? "" : path}`;
}
