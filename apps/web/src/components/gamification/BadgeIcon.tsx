import React from "react";
import { Lock } from "lucide-react";
import { BADGE_ICONS, FALLBACK_BADGE_ICON } from "./badgeIcons";
import type { BadgeTier } from "../../hooks/useGamification";
import { TIER_STYLE } from "./tiers";


/** A badge's medal: coloured when earned, grey with a lock until then */
export const BadgeIcon: React.FC<{ icon: string; tier: BadgeTier; earned: boolean; size?: number }> = ({ icon, tier, earned, size = 48 }) => {
  const Icon = BADGE_ICONS[icon] ?? FALLBACK_BADGE_ICON;
  const style = TIER_STYLE[tier];
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${earned ? "" : "bg-slate-100 dark:bg-white/[0.05]"}`}
      style={{
        width: size,
        height: size,
        ...(earned ? { background: style.fill, boxShadow: `inset 0 0 0 2px ${style.ring}` } : {}),
      }}
      aria-hidden
    >
      <Icon
        style={{ width: size * 0.45, height: size * 0.45, color: earned ? style.ring : undefined }}
        className={earned ? "" : "text-slate-300 dark:text-slate-600"}
      />
      {!earned && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-panel border border-slate-200 dark:border-white/10 flex items-center justify-center">
          <Lock className="w-2.5 h-2.5 text-slate-400" />
        </span>
      )}
    </span>
  );
};

export default BadgeIcon;
