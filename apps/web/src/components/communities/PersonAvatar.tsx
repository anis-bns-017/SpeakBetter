// apps/web/src/components/communities/PersonAvatar.tsx
import React from "react";

export const PersonAvatar: React.FC<{ name: string; url?: string | null; size?: "sm" | "md" }> = ({ name, url, size = "md" }) => {
  const box = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return url ? (
    <img src={url} alt="" className={`${box} rounded-full object-cover shrink-0`} />
  ) : (
    <span className={`${box} rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 flex items-center justify-center font-bold shrink-0`} aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  );
};
