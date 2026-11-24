import { beforeEach, describe, expect, it } from "vitest";
import { clearReturn, forgetReturnOnSignOut, isSafeReturn, peekReturn, rememberReturn, resetReturnState } from "./returnTo";

beforeEach(() => resetReturnState());

describe("return address", () => {
  it("remembers an invite link, with its query", () => {
    rememberReturn("/voice/room123?from=invite");
    expect(peekReturn()).toBe("/voice/room123?from=invite");
  });

  it("can be read more than once (React may render twice) until cleared", () => {
    rememberReturn("/join/abc");
    expect(peekReturn()).toBe("/join/abc");
    expect(peekReturn()).toBe("/join/abc");
    clearReturn();
    expect(peekReturn()).toBeNull();
  });

  it("never accepts an address outside the app", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "\\\\evil.example", "evil", "/x\nSet-Cookie:a", "", null, 42]) {
      expect(isSafeReturn(bad)).toBe(false);
    }
  });

  it("ignores a tampered stored value", () => {
    sessionStorage.setItem("sb.returnTo", "//evil.example");
    expect(peekReturn()).toBeNull();
  });

  it("does not treat start pages as destinations", () => {
    for (const page of ["/", "/dashboard", "/welcome", "/login", "/register", "/login?x=1"]) {
      rememberReturn(page);
      expect(peekReturn()).toBeNull();
    }
  });

  it("forgets the page when someone signs out on purpose", () => {
    rememberReturn("/settings");
    forgetReturnOnSignOut();
    expect(peekReturn()).toBeNull();
    rememberReturn("/settings");
    expect(peekReturn()).toBeNull();
  });
});
