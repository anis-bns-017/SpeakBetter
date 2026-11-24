// apps/web/src/lib/languageName.ts
import { tr } from "../i18n/core";

/** Profiles hold a code ("en") or a name ("English"); people should always read a name */
export function languageLabel(value?: string | null, lang: string = "en"): string {
  const text = value?.trim() ?? "";
  if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(text)) return text;
  try {
    return new Intl.DisplayNames([lang === "bn" ? "bn" : "en"], { type: "language" }).of(text) ?? text;
  } catch {
    return text;
  }
}

/** Why someone was suggested, in the reader's language */
export function suggestionReason(person: { reason?: string; reasonParts?: { text: string; vars: Record<string, string> } }): string {
  if (!person.reasonParts) return person.reason ?? "";
  const vars = Object.fromEntries(Object.entries(person.reasonParts.vars).map(([key, value]) => [key, tr(value)]));
  return tr(person.reasonParts.text, vars);
}
