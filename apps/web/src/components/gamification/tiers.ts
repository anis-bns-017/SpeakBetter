import type { BadgeTier } from "../../hooks/useGamification";

/** Metal colours for badge rings (decoration, not data) */
export const TIER_STYLE: Record<BadgeTier, { ring: string; fill: string; label: string }> = {
  BRONZE: { ring: "#b4733c", fill: "rgba(180,115,60,0.14)", label: "Bronze" },
  SILVER: { ring: "#8a94a6", fill: "rgba(138,148,166,0.16)", label: "Silver" },
  GOLD: { ring: "#d4a017", fill: "rgba(212,160,23,0.16)", label: "Gold" },
  PLATINUM: { ring: "#5b8bb5", fill: "rgba(91,139,181,0.16)", label: "Platinum" },
  DIAMOND: { ring: "#2bb3d9", fill: "rgba(43,179,217,0.16)", label: "Diamond" },
};
