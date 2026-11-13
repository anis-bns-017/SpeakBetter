import { describe, expect, it } from "vitest";
import type { User } from "../contexts/useAuth";
import { needsWelcome } from "./welcomeGate";

const profile = (onboardedAt: string | null | undefined): User["profile"] => ({
  nativeLanguage: "bn",
  learningLanguages: ["en"],
  xp: 0,
  streak: 0,
  onboardedAt,
});

describe("needsWelcome", () => {
  it("sends a new account to the first-day guide", () => {
    expect(needsWelcome({ profile: profile(null) }, "/dashboard")).toBe(true);
    expect(needsWelcome({ profile: profile(null) }, "/voice")).toBe(true);
  });

  it("lets a new account open the guide itself and the level test", () => {
    expect(needsWelcome({ profile: profile(null) }, "/welcome")).toBe(false);
    expect(needsWelcome({ profile: profile(null) }, "/placement")).toBe(false);
  });

  it("leaves people who finished (or skipped) the guide alone", () => {
    expect(needsWelcome({ profile: profile("2026-11-12T09:00:00Z") }, "/dashboard")).toBe(false);
  });

  it("does nothing when the server doesn't know about the guide", () => {
    expect(needsWelcome({ profile: profile(undefined) }, "/dashboard")).toBe(false);
    expect(needsWelcome({ profile: undefined }, "/dashboard")).toBe(false);
  });
});
