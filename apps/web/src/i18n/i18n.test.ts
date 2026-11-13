import { afterEach, describe, expect, it } from "vitest";
import { bn } from "./bn";
import { fill, isLang, setCurrentLang, translate } from "./core";

describe("fill", () => {
  it("puts values into {placeholders}", () => {
    expect(fill("Hi {name}, {n} days", { name: "Rina", n: 3 })).toBe("Hi Rina, 3 days");
  });

  it("leaves unknown placeholders alone", () => {
    expect(fill("Hi {name}", { other: 1 })).toBe("Hi {name}");
  });
});

describe("translate", () => {
  afterEach(() => setCurrentLang("en"));

  it("returns English when the app is in English", () => {
    setCurrentLang("en");
    expect(translate("Settings")).toBe("Settings");
  });

  it("returns Bangla when the app is in Bangla, and falls back to English for unknown text", () => {
    setCurrentLang("bn");
    expect(translate("Settings")).toBe(bn["Settings"]);
    expect(translate("Some text nobody translated")).toBe("Some text nobody translated");
  });
});

describe("isLang", () => {
  it("accepts only the languages the app has", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("bn")).toBe(true);
    expect(isLang("es")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe("Bangla dictionary", () => {
  // Every t("…") / tr("…") call with a written-out English text needs a Bangla entry
  const sources = import.meta.glob(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!./bn.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  // t("…") / tr("…") on screens, msg("…") in lists defined outside components
  const CALL = /\b(?:t|tr|msg)\(\s*"((?:[^"\\]|\\.)*)"/g;

  const used = new Map<string, string>();
  for (const [file, text] of Object.entries(sources)) {
    for (const m of text.matchAll(CALL)) used.set(m[1].replace(/\\"/g, '"'), file);
  }

  it("finds the translated screens", () => {
    expect(used.size).toBeGreaterThan(200);
  });

  it("has an entry for every translated text", () => {
    const missing = [...used.entries()].filter(([key]) => !(key in bn)).map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it("only uses {placeholders} the English text has", () => {
    // A translation may leave one out (Bangla has no plural "s"), but never invent one
    const names = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    const wrong = Object.entries(bn).filter(([en, bangla]) => [...names(bangla)].some((n) => !names(en).has(n)));
    expect(wrong).toEqual([]);
  });
});
