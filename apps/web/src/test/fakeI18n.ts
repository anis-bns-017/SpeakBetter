// apps/web/src/test/fakeI18n.ts
// A stand-in for useT() in component tests: English text with {placeholders} filled, no server calls.
import { vi } from "vitest";
import { fill, type Vars } from "../i18n/core";

export const setLang = vi.fn();

export const fakeUseT = () => ({
  lang: "en" as const,
  setLang,
  t: (text: string, vars?: Vars) => fill(text, vars),
});
