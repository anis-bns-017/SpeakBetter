import { describe, expect, it } from "vitest";
import { ALL_PHRASES, SITUATIONS, searchPhrases } from "./phrasebook";

describe("phrasebook content", () => {
  it("has every phrase filled in, with a unique id", () => {
    expect(ALL_PHRASES.length).toBeGreaterThanOrEqual(48);
    expect(new Set(ALL_PHRASES.map((p) => p.id)).size).toBe(ALL_PHRASES.length);
    for (const p of ALL_PHRASES) {
      expect(p.en.trim().length).toBeGreaterThan(5);
      expect(p.note.trim().length).toBeGreaterThan(5);
      // Bangla letters, so a gloss never silently falls back to English
      expect(p.bn).toMatch(/[ঀ-৿]/);
    }
  });

  it("never repeats an English phrase", () => {
    const en = ALL_PHRASES.map((p) => p.en.toLowerCase());
    expect(new Set(en).size).toBe(en.length);
  });

  it("gives every situation at least six phrases", () => {
    for (const s of SITUATIONS) expect(s.phrases.length).toBeGreaterThanOrEqual(6);
  });
});

describe("searchPhrases", () => {
  it("finds by any word, in any order, ignoring case", () => {
    const found = searchPhrases("BILL please");
    expect(found.some((p) => p.id === "food-4")).toBe(true);
  });

  it("can be limited to one situation", () => {
    const all = searchPhrases("");
    const food = searchPhrases("", "food");
    expect(food.length).toBe(6);
    expect(food.every((p) => p.situation === "food")).toBe(true);
    expect(all.length).toBe(ALL_PHRASES.length);
  });

  it("finds nothing for a word that is not there", () => {
    expect(searchPhrases("zzzxqj")).toEqual([]);
  });
});
