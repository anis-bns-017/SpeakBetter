// apps/web/src/components/call/CallRecap.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookmarkPlus, Check, Flag, Handshake, Lightbulb, Loader2, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { COLORS } from "../voice/lobby/lobbyTheme";
import { callApi } from "./callApi";
import { CallAvatar } from "./CallScreens";
import type { EndedCall } from "./useRandomCall";
import { tr, msg } from "../../i18n/core";

const REASON_TEXT: Record<string, string> = {
  COMPLETED: msg("Time is up"),
  LEFT: msg("The call ended"),
  REPORTED: msg("The call was ended after a report"),
  DISCONNECTED: msg("The connection was lost"),
};

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const CallRecap: React.FC<{
  ended: EndedCall;
  /** Tips your partner sent during the call */
  tips: string[];
  /** Words you saved from captions */
  savedWords: string[];
  onAgain: () => void;
  onLobby: () => void;
  onReport: () => void;
}> = ({ ended, tips, savedWords, onAgain, onLobby, onReport }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mutualFriend: boolean } | null>(null);

  const total = ended.meTalkSeconds + ended.partnerTalkSeconds;
  const myShare = total > 0 ? Math.round((ended.meTalkSeconds / total) * 100) : null;
  const reported = ended.reason === "REPORTED";

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    try {
      const res = await callApi.rate(ended.callId, {
        rating,
        keepInTouch: keep,
        talkSeconds: ended.meTalkSeconds,
      });
      setResult({ mutualFriend: res.mutualFriend });
      if (res.mutualFriend) toast.success(tr("You and {partnerName} are now friends", { partnerName: ended.partnerName }));
    } catch {
      toast.error(tr("Could not save your rating. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const stat = (label: string, value: string) => (
    <div className="rounded-2xl border px-4 py-3 text-center" style={{ borderColor: COLORS.border, background: "var(--sx-bg-28-20-48-600)" }}>
      <p className="text-xl font-semibold tabular-nums" style={{ color: COLORS.textPrimary }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: COLORS.textMuted }}>
        {tr(label)}
      </p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-md py-6">
      <div className="flex flex-col items-center text-center">
        <CallAvatar name={ended.partnerName} size={84} />
        <h2 className="mt-4 font-serif text-2xl" style={{ color: COLORS.textPrimary }}>
          {reported ? tr("Thanks for telling us") : tr("Great practice with {partnerName}", { partnerName: ended.partnerName })}
        </h2>
        <p className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
          {tr(REASON_TEXT[ended.reason]) ?? tr("The call ended")}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {stat("Call time", formatDuration(ended.seconds))}
        {stat("You spoke", formatDuration(ended.meTalkSeconds))}
        {stat("Your share", myShare === null ? "-" : `${myShare}%`)}
      </div>

      {ended.xp > 0 && (
        <p
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold"
          role="status"
          style={{ borderColor: `color-mix(in srgb, ${COLORS.spotlight} 33.3%, transparent)`, background: COLORS.spotlightDim, color: COLORS.spotlight }}
        >
          <Sparkles className="h-4 w-4" />{tr("+{xp} XP for speaking today", { xp: ended.xp })}</p>
      )}

      {tips.length > 0 && (
        <section className="mt-6 rounded-3xl border p-5" style={{ borderColor: COLORS.border, background: COLORS.surface }} aria-label={tr("Tips from your partner")}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
            <Lightbulb className="h-4 w-4" style={{ color: COLORS.spotlight }} />
            {tr("Tips from")}{" "}{ended.partnerName}
          </h3>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={`${i}-${tip}`} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: COLORS.border, color: COLORS.textPrimary }}>
                {tr(tip)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {savedWords.length > 0 && (
        <section className="mt-4 rounded-3xl border p-5" style={{ borderColor: COLORS.border, background: COLORS.surface }} aria-label={tr("Words you saved")}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
            <BookmarkPlus className="h-4 w-4" style={{ color: COLORS.live }} />
            {tr("Words you saved")}</h3>
          <div className="flex flex-wrap gap-2">
            {savedWords.map((word) => (
              <span key={word} className="rounded-full px-3 py-1 text-sm" style={{ background: COLORS.liveDim, color: COLORS.live }}>
                {word}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: COLORS.textMuted }}>
            {tr("They are in your word bank, ready to review.")}</p>
        </section>
      )}

      {!reported && !result && (
        <div className="mt-6 rounded-3xl border p-5" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          <p className="text-center text-sm font-medium" style={{ color: COLORS.textPrimary }}>
            {tr("How was the conversation?")}</p>
          <div className="mt-3 flex justify-center gap-1" role="radiogroup" aria-label={tr("Rating")}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={rating === value}
                aria-label={tr("{value} star{value2}", { value, value2: value > 1 ? "s" : "" })}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(value)}
                className="p-1"
              >
                <Star
                  className="h-8 w-8 transition-transform hover:scale-110"
                  style={{ color: COLORS.spotlight }}
                  fill={(hover || rating) >= value ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>

          <label
            className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm"
            style={{ borderColor: keep ? COLORS.spotlight : COLORS.border, background: keep ? COLORS.spotlightDim : "transparent" }}
          >
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5 accent-[var(--sx-bg-f5a623)]" />
            <span>
              <span className="flex items-center gap-1.5 font-medium" style={{ color: COLORS.textPrimary }}>
                <Handshake className="h-4 w-4" style={{ color: COLORS.spotlight }} />
                {tr("Keep in touch")}</span>
              <span className="mt-0.5 block text-xs" style={{ color: COLORS.textMuted }}>
                {tr("You become friends only if {partnerName} says yes too. They will not see your choice otherwise.", { partnerName: ended.partnerName })}</span>
            </span>
          </label>

          <button
            onClick={submit}
            disabled={!rating || busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-50"
            style={{ background: COLORS.spotlight, color: COLORS.void }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr("Save")}</button>
        </div>
      )}

      {result && (
        <p
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm"
          role="status"
          style={{ borderColor: `color-mix(in srgb, ${COLORS.live} 33.3%, transparent)`, background: COLORS.liveDim, color: COLORS.live }}
        >
          <Check className="h-4 w-4" />
          {result.mutualFriend
            ? tr("You and {partnerName} are friends now.", { partnerName: ended.partnerName })
            : keep
              ? tr("Saved. If {partnerName} says yes too, you will be friends.", { partnerName: ended.partnerName })
              : tr("Thanks, saved.")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onAgain} className="rounded-full px-6 py-2.5 text-sm font-semibold" style={{ background: COLORS.spotlight, color: COLORS.void }}>
          {tr("Call again")}</button>
        <button onClick={onLobby} className="rounded-full border px-6 py-2.5 text-sm font-medium hover:bg-white/5" style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}>
          {tr("Back to rooms")}</button>
      </div>

      {!reported && (
        <button onClick={onReport} className="mx-auto mt-5 flex items-center gap-1.5 text-xs hover:opacity-80" style={{ color: COLORS.textMuted }}>
          <Flag className="h-3.5 w-3.5" /> {" "}{tr("Something went wrong? Report")}{" "}{ended.partnerName}
        </button>
      )}
    </motion.div>
  );
};
