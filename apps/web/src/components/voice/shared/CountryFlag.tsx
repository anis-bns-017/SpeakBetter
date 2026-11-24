// apps/web/src/components/voice/shared/CountryFlag.tsx
/**
 * A person's country flag as a small round badge. It is a picture, not an emoji, because Windows draws flag
 * emoji as two plain letters ("BD"). Shows nothing when the country is missing or unknown (no placeholder globe).
 * If the picture can't load (offline), the emoji is shown instead.
 */

import React, { useState } from "react";
import { countryName, flagEmoji, resolveCountryCode } from "../../../lib/countryFlag";

interface CountryFlagProps {
  /** Whatever the profile holds: "BD", "Bangladesh", "বাংলাদেশ"… */
  country?: string | null;
  /** Diameter in px */
  size?: number;
  className?: string;
  /** Colour of the ring that separates the badge from what's behind it */
  ringColor?: string;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ country, size = 16, className = "", ringColor = "rgb(8 24 24)" }) => {
  const code = resolveCountryCode(country);
  const [failedCode, setFailedCode] = useState<string | null>(null);
  if (!code) return null;
  const name = countryName(code);
  const lower = code.toLowerCase();

  if (failedCode === code) {
    return (
      <span role="img" aria-label={name} title={name} className={`leading-none ${className}`} style={{ fontSize: size * 0.8 }}>
        {flagEmoji(code)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedCode(code)}
      className={`inline-block shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ringColor}, 0 2px 6px rgb(0 0 0 / 0.35)` }}
    />
  );
};

export default CountryFlag;
