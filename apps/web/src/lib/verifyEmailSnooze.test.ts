import { beforeEach, describe, expect, it } from "vitest";
import { SNOOZE_DAYS, clearSnooze, isSnoozed, snooze } from "./verifyEmailSnooze";

const DAY = 24 * 60 * 60 * 1000;

describe("putting off the confirm-your-email reminder", () => {
  beforeEach(() => localStorage.clear());

  it("hides it for a few days, then brings it back", () => {
    const now = 1_000_000;
    expect(isSnoozed("u1", now)).toBe(false);
    snooze("u1", now);
    expect(isSnoozed("u1", now + DAY)).toBe(true);
    expect(isSnoozed("u1", now + SNOOZE_DAYS * DAY + 1)).toBe(false);
  });

  it("is kept per account", () => {
    snooze("u1");
    expect(isSnoozed("u2")).toBe(false);
    expect(isSnoozed(undefined)).toBe(false);
  });

  it("comes back at once when something needs a confirmed email", () => {
    snooze("u1");
    clearSnooze("u1");
    expect(isSnoozed("u1")).toBe(false);
  });
});
