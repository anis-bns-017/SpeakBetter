import { describe, expect, it } from "vitest";
import { canManage, inviteCodeFrom, isAdmin, isModerator } from "./communityRoles";

describe("community roles", () => {
  it("knows who can run what", () => {
    expect(isAdmin("OWNER")).toBe(true);
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isAdmin("MODERATOR")).toBe(false);
    expect(isModerator("MODERATOR")).toBe(true);
    expect(isModerator("MEMBER")).toBe(false);
    expect(isModerator(null)).toBe(false);
  });

  it("only lets admins manage people below them", () => {
    expect(canManage("OWNER", "ADMIN")).toBe(true);
    expect(canManage("ADMIN", "MEMBER")).toBe(true);
    expect(canManage("ADMIN", "ADMIN")).toBe(false);
    expect(canManage("ADMIN", "OWNER")).toBe(false);
    expect(canManage("MODERATOR", "MEMBER")).toBe(false);
    expect(canManage(null, "MEMBER")).toBe(false);
  });
});

describe("inviteCodeFrom", () => {
  it("takes a code or a whole link", () => {
    expect(inviteCodeFrom("  abc123 ")).toBe("abc123");
    expect(inviteCodeFrom("https://app.example/communities/join/abc123")).toBe("abc123");
    expect(inviteCodeFrom("https://app.example/communities/join/abc123/?from=chat")).toBe("abc123");
  });
});
