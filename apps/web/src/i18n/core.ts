// apps/web/src/i18n/core.ts
// Shared pieces of the translation system (see i18n/index.tsx).

import { bn } from "./bn";

export type Lang = "en" | "bn";
export const LANGUAGES: Array<{ code: Lang; name: string; native: string }> = [
  { code: "en", name: "English", native: "English" },
  { code: "bn", name: "Bangla", native: "বাংলা" },
];

export const STORAGE_KEY = "sb.lang";
export const FONT_ID = "sb-bangla-font";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "bn";

/** Values for {placeholders}; a missing value (null/undefined) shows as nothing */
export type Vars = Record<string, string | number | null | undefined>;

export const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)) : text;

/**
 * The language the app is showing right now. LanguageProvider sets it before the screens draw, and the whole app
 * redraws when it changes, so tr() below is always current.
 */
let current: Lang = "en";
export const setCurrentLang = (lang: Lang) => {
  current = lang;
};
export const currentLang = (): Lang => current;

/** Translates text anywhere: in components, hooks, toasts and plain functions */
export function translate(text: string | null | undefined, vars?: Vars): string {
  if (text == null) return "";
  return fill(current === "bn" ? (bn[text] ?? text) : text, vars);
}

/** Short name for translate(), used across the screens */
export const tr = translate;

/**
 * Marks English text kept in a list outside a component ({ label: msg("Most active") }). It returns the text
 * unchanged; the screen translates it where it is shown, with tr(item.label). The mark lets the dictionary test
 * find every such text.
 */
export const msg = (text: string) => text;

