// apps/web/src/lib/communityRoles.ts
/** The same role rules the server enforces, so the page only offers what will work. */
import { msg } from "../i18n/core";

export type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

const RANK: Record<MemberRole, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

export const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: msg("Owner"),
  ADMIN: msg("Admin"),
  MODERATOR: msg("Moderator"),
  MEMBER: msg("Member"),
};

export const ASSIGNABLE_ROLES: MemberRole[] = ["ADMIN", "MODERATOR", "MEMBER"];

export const rankOf = (role: string | null | undefined): number => (role && role in RANK ? RANK[role as MemberRole] : -1);

export const isAdmin = (role: string | null | undefined) => rankOf(role) >= RANK.ADMIN;
export const isModerator = (role: string | null | undefined) => rankOf(role) >= RANK.MODERATOR;

/** Removing or banning someone needs admin rights and a higher role than theirs */
export const canManage = (actor: string | null | undefined, target: string) => isAdmin(actor) && rankOf(actor) > rankOf(target);

/** A pasted invite can be the code or the whole link */
export const inviteCodeFrom = (text: string) => {
  const clean = text.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1);
};
