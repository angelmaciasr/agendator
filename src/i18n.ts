import es from "./locales/es.js";
import en from "./locales/en.js";
export type Language = "es" | "en";
export type TranslationKey = keyof typeof es;
const dictionaries = { es, en };
let language: Language = "es";
try {
  if (
    typeof window !== "undefined" &&
    window.localStorage.getItem("agendator-language") === "en"
  )
    language = "en";
} catch {
  /* Storage is optional. */
}
export const getLanguage = () => language;
export function setLanguage(next: Language) {
  language = next;
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem("agendator-language", next);
  } catch {
    /* Storage is optional. */
  }
}
export function translate(
  key: TranslationKey,
  params: Record<string, string | number> = {},
  lang: Language = language,
): string {
  return dictionaries[lang][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? `{${name}}`),
  );
}
export const t = translate;
export const translator =
  (lang: Language = "es") =>
  (key: TranslationKey, params: Record<string, string | number> = {}) =>
    translate(key, params, lang);
export const locale = (lang: Language = language) =>
  lang === "en" ? "en-US" : "es-ES";
const weekdayKeys = [
  "calendar.monday",
  "calendar.tuesday",
  "calendar.wednesday",
  "calendar.thursday",
  "calendar.friday",
  "calendar.saturday",
  "calendar.sunday",
] as const;
export const weekdays = (lang: Language = language) =>
  weekdayKeys.map((key) => translate(key, {}, lang));
const monthKeys = [
  "calendar.january",
  "calendar.february",
  "calendar.march",
  "calendar.april",
  "calendar.may",
  "calendar.june",
  "calendar.july",
  "calendar.august",
  "calendar.september",
  "calendar.october",
  "calendar.november",
  "calendar.december",
] as const;
export const months = (lang: Language = language) =>
  monthKeys.map((key) => translate(key, {}, lang));
