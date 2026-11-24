import { describe, expect, it } from "vitest";
import { countryName, countryOptions, flagEmoji, resolveCountryCode } from "./countryFlag";

describe("resolveCountryCode", () => {
  it("accepts codes in any case", () => {
    expect(resolveCountryCode("BD")).toBe("BD");
    expect(resolveCountryCode("bd")).toBe("BD");
    expect(resolveCountryCode(" in ")).toBe("IN");
  });

  it("understands English and Bangla country names", () => {
    expect(resolveCountryCode("Bangladesh")).toBe("BD");
    expect(resolveCountryCode("  bangladesh ")).toBe("BD");
    expect(resolveCountryCode("বাংলাদেশ")).toBe("BD");
    expect(resolveCountryCode("India")).toBe("IN");
  });

  it("understands the short names people actually type", () => {
    expect(resolveCountryCode("USA")).toBe("US");
    expect(resolveCountryCode("UK")).toBe("GB");
    expect(resolveCountryCode("United Kingdom")).toBe("GB");
    expect(resolveCountryCode("UAE")).toBe("AE");
  });

  it("returns null for blanks and things that are not countries", () => {
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode(undefined)).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
    expect(resolveCountryCode("xx")).toBeNull();
    expect(resolveCountryCode("Atlantis")).toBeNull();
  });
});

describe("flagEmoji and countryName", () => {
  it("builds the flag from the code", () => {
    expect(flagEmoji("BD")).toBe("🇧🇩");
    expect(flagEmoji("us")).toBe("🇺🇸");
  });

  it("names a country in English", () => {
    expect(countryName("BD")).toBe("Bangladesh");
  });
});

describe("countryOptions", () => {
  it("lists every country once, sorted by name, each resolvable back to its code", () => {
    const options = countryOptions();
    expect(options.length).toBeGreaterThan(230);
    expect(new Set(options.map((o) => o.code)).size).toBe(options.length);
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const o of options) expect(resolveCountryCode(o.code)).toBe(o.code);
  });
});
