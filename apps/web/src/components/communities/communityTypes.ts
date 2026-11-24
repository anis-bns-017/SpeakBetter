// apps/web/src/components/communities/communityTypes.ts
import { msg } from "../../i18n/core";

export const COMMUNITY_TYPES = [
  { id: "PUBLIC", label: msg("Public"), help: msg("Anyone can find it and join.") },
  { id: "RESTRICTED", label: msg("Restricted"), help: msg("Anyone can find it, but joining needs an invite.") },
  { id: "PRIVATE", label: msg("Private"), help: msg("Hidden from search. Only people with an invite can see it.") },
] as const;
