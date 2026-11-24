// apps/web/src/components/voice/shared/ProfilePeek.tsx
/**
 * Tapping someone in a voice room shows who they are in a small card. It stays on top of the room, because going to
 * another page would take you out of the call. The full profile opens in a new tab for the same reason.
 */
import React, { useEffect } from "react";
import { ExternalLink, Flame, Loader2, Star, X } from "lucide-react";
import { useUserProfile } from "../../../hooks/usePublicProfile";
import { isNativeApp } from "../../../lib/pwa";
import { countryName, resolveCountryCode } from "../../../lib/countryFlag";
import { CountryFlag } from "./CountryFlag";
import { tr } from "../../../i18n/core";

/** Profiles may hold a code ("en") or a name ("English"): always show the name */
const languageName = (value: string) => {
  if (!/^[a-z]{2,3}$/i.test(value)) return value;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(value.toLowerCase()) ?? value;
  } catch {
    return value;
  }
};

export const ProfilePeek: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const { data, isLoading, isError } = useUserProfile(userId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const full = data && !data.private ? data : null;
  const code = resolveCountryCode(full?.country);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={data?.name ?? tr("Profile")}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border border-line bg-surface p-5 text-slate-900 shadow-2xl dark:text-white"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Close")}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {isLoading && (
          <div className="flex justify-center py-10" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label={tr("Loading")} />
          </div>
        )}

        {isError && <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">{tr("Couldn't load this profile.")}</p>}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pr-8">
              <div className="relative h-14 w-14 shrink-0">
                {data.avatarUrl ? (
                  <img src={data.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
                    {data.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {full?.country && <CountryFlag country={full.country} size={18} className="absolute -bottom-0.5 -left-0.5" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{data.name}</p>
                {full && (
                  <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                    {[full.level, code ? countryName(code) : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {data.private && <p className="text-sm text-slate-600 dark:text-slate-300">{tr("This person keeps their profile private.")}</p>}

            {full?.bio && <p className="line-clamp-3 text-sm text-slate-700 dark:text-slate-300">{full.bio}</p>}

            {full && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/[0.06]">
                  <Flame className="h-4 w-4 text-orange-500" aria-hidden />
                  {tr("{days} day streak", { days: full.stats.streak })}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/[0.06]">
                  <Star className="h-4 w-4 text-amber-500" aria-hidden />
                  {full.stats.xp} XP
                </div>
              </div>
            )}

            {full && (full.nativeLanguage || full.learningLanguages.length > 0) && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {full.nativeLanguage && <>{tr("Speaks")} <b>{languageName(full.nativeLanguage)}</b></>}
                {full.nativeLanguage && full.learningLanguages.length > 0 && " · "}
                {full.learningLanguages.length > 0 && <>{tr("Learning")} <b>{full.learningLanguages.map(languageName).join(", ")}</b></>}
              </p>
            )}

            {/* The phone app has no second tab: opening the page there would end the call */}
            {!isNativeApp() && (
              <a
                href={`/u/${userId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {tr("Full profile")} <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePeek;
