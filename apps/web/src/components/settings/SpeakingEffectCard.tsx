// apps/web/src/components/settings/SpeakingEffectCard.tsx
/** Settings: the effect everyone in a voice room sees around your avatar while you talk (20 to pick from). */

import React, { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "../../lib/api/client";
import { apiErrorMessage } from "../../lib/api/errors";
import { useProfile, type Profile } from "../../hooks/useProfile";
import { useT } from "../../i18n";
import { SpeakingEffect } from "../voice/effects/SpeakingEffect";
import {
  SPEAKING_EFFECT_GROUPS,
  SPEAKING_EFFECTS,
  readSpeakingEffect,
  speakingEffectInfo,
  type SpeakingEffectId,
} from "../voice/effects/speakingEffects";
import { hueFromString, initials } from "../voice/VoiceRoomView.helpers";

/** A voice level that rises and falls like speech, so the previews move the way they will in a room */
function useTalkingLevel() {
  const [level, setLevel] = useState(0.5);
  useEffect(() => {
    let t = 0;
    const timer = window.setInterval(() => {
      t += 1;
      setLevel(0.35 + 0.3 * Math.abs(Math.sin(t / 3)) + 0.2 * Math.abs(Math.sin(t * 1.7)));
    }, 160);
    return () => window.clearInterval(timer);
  }, []);
  return level;
}

/** An avatar (photo or initials) with an effect playing around it */
const EffectAvatar: React.FC<{ effect: SpeakingEffectId; size: number; level: number; name: string; avatarUrl?: string | null }> = ({
  effect,
  size,
  level,
  name,
  avatarUrl,
}) => {
  const hue = hueFromString(name || "?");
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <SpeakingEffect effect={effect} layer="back" size={size} level={level} talking />
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full border-2 font-semibold text-white"
        style={{
          borderColor: "rgba(129,140,248,0.9)",
          background: avatarUrl ? `url(${avatarUrl}) center/cover` : `linear-gradient(145deg, hsl(${hue},55%,34%), hsl(${(hue + 40) % 360},50%,20%))`,
          fontSize: size / 3,
        }}
      >
        {!avatarUrl && initials(name || "?")}
      </div>
      <SpeakingEffect effect={effect} layer="front" size={size} level={level} talking />
    </div>
  );
};

export const SpeakingEffectCard: React.FC = () => {
  const { t } = useT();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const level = useTalkingLevel();
  const saved = readSpeakingEffect(profile?.user?.speakingEffect);
  const [picked, setPicked] = useState<SpeakingEffectId | null>(null);
  const current = picked ?? saved;
  const name = profile?.user?.name ?? "";
  const avatarUrl = profile?.user?.avatarUrl;

  const save = useMutation({
    mutationFn: async (effect: SpeakingEffectId) =>
      (await apiClient.put<{ speakingEffect: string }>("/profile/me/speaking-effect", { effect })).data,
    onSuccess: (data) => {
      queryClient.setQueryData<Profile | undefined>(["profile"], (old) =>
        old ? { ...old, user: { ...old.user, speakingEffect: data.speakingEffect } } : old,
      );
      setPicked(null);
      toast.success(t("Speaking effect saved"));
    },
    onError: (error) => {
      setPicked(null);
      toast.error(apiErrorMessage(error, t("Couldn't save your speaking effect. Try again.")));
    },
  });

  const choose = (effect: SpeakingEffectId) => {
    if (effect === current || save.isPending) return;
    setPicked(effect);
    save.mutate(effect);
  };

  const info = speakingEffectInfo(current);

  return (
    <section aria-labelledby="speaking-effect-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="speaking-effect-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <Sparkles aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {t("Speaking effect")}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {t("Everyone in a voice room sees this around your avatar while you talk. It grows with your voice.")}
      </p>

      {/* The chosen one, big */}
      <div className="mt-5 flex items-center gap-6 overflow-hidden rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #12122a, #1e1b4b)" }}>
        <div className="grid h-44 w-44 shrink-0 place-items-center">
          <EffectAvatar key={current} effect={current} size={76} level={level} name={name} avatarUrl={avatarUrl} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/80">{t("Your effect")}</p>
          <p className="mt-0.5 flex items-center gap-2 text-lg font-bold text-white">
            {t(info.name)}
            {save.isPending && <Loader2 aria-label={t("Saving…")} className="h-4 w-4 animate-spin text-indigo-200" />}
          </p>
          <p className="mt-1 text-sm text-indigo-100/80">{t(info.description)}</p>
        </div>
      </div>

      {SPEAKING_EFFECT_GROUPS.map((group) => {
        const effects = SPEAKING_EFFECTS.filter((e) => e.group === group.id);
        return (
          <div key={group.id} className="mt-6">
            <h3 id={`effects-${group.id}`} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t(group.label)}
            </h3>
            <div role="radiogroup" aria-labelledby={`effects-${group.id}`} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {effects.map((effect) => {
                const on = effect.id === current;
                return (
                  <button
                    key={effect.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={t(effect.description)}
                    onClick={() => choose(effect.id)}
                    className={`relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border px-2 pb-3 pt-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      on ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-line hover:border-indigo-300"
                    }`}
                    style={{ background: "linear-gradient(160deg, #15152e, #23204f)" }}
                  >
                    <div className="grid h-[118px] w-full place-items-center">
                      <EffectAvatar effect={effect.id} size={52} level={level} name={name} avatarUrl={avatarUrl} />
                    </div>
                    <span className="text-xs font-semibold text-white">{t(effect.name)}</span>
                    {on && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-indigo-500 text-white">
                        <Check aria-hidden className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default SpeakingEffectCard;
