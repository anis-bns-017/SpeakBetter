// apps/web/src/components/gamification/CelebrationLayer.tsx
/**
 * The moments worth a full screen: a new badge being revealed, and last week's league result (a podium and
 * the league you move to). Shown once each, the next time you open the app or the moment a badge arrives.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUp, Flame, Gift, Medal, Snowflake, Trophy, X, Zap } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCelebrations, useMarkCelebrated, type Celebrations } from "../../hooks/useGamification";
import { useMarkQuestNews, useQuests, useStreak, type StreakStatus, type WeeklyQuests } from "../../hooks/useQuests";
import { BadgeIcon } from "./BadgeIcon";
import { ShareCardButton } from "./ShareCardDialog";
import { TIER_STYLE } from "./tiers";

interface Piece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  spin: number;
  color: string;
}

const makePieces = (colors: string[]): Piece[] =>
  Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.6,
    size: 6 + Math.random() * 6,
    spin: (Math.random() - 0.5) * 720,
    color: colors[i % colors.length],
  }));

/** A burst of falling paper, in the colours of what is being celebrated */
const Confetti: React.FC<{ colors: string[] }> = ({ colors }) => {
  const [pieces] = useState(() => makePieces(colors));
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, background: p.color }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", rotate: p.spin, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
};

const Backdrop: React.FC<{ onClose: () => void; children: React.ReactNode; label: string }> = ({ onClose, children, label }) =>
  createPortal(
    <motion.div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {children}
    </motion.div>,
    document.body,
  );

// ============================================================
// Badge reveal
// ============================================================

const BadgeReveal: React.FC<{
  badge: Celebrations["badges"][number];
  position: { index: number; total: number };
  reduced: boolean;
  onNext: () => void;
  onSeeAll: () => void;
}> = ({ badge, position, reduced, onNext, onSeeAll }) => {
  const { user } = useAuth();
  const tier = TIER_STYLE[badge.tier];
  const last = position.index === position.total - 1;
  return (
    <Backdrop onClose={onNext} label={`New badge: ${badge.name}`}>
      {!reduced && <Confetti key={`confetti-${badge.key}`} colors={[tier.ring, "#6366f1", "#f59e0b", "#10b981", "#ec4899"]} />}
      <motion.div
        key={badge.key}
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-panel p-7 text-center shadow-2xl"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <button type="button" onClick={onNext} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: tier.ring }}>
          New badge{position.total > 1 ? ` · ${position.index + 1} of ${position.total}` : ""}
        </p>
        <motion.div
          className="mx-auto mt-5 w-fit rounded-full"
          initial={reduced ? false : { scale: 0.2, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          style={{ boxShadow: `0 0 0 10px ${tier.fill}, 0 0 60px ${tier.ring}55` }}
        >
          <BadgeIcon icon={badge.icon} tier={badge.tier} earned size={112} />
        </motion.div>
        <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">{badge.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{badge.description}</p>
        <p className="mt-2 text-xs font-semibold" style={{ color: tier.ring }}>
          {tier.label}
        </p>
        <ShareCardButton
          variant="soft"
          label="Share this badge"
          className="mt-5 w-full"
          card={{ kind: "badge", person: user?.name ?? "A SpeakBetter learner", name: badge.name, description: badge.description, tier: badge.tier, icon: badge.icon }}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSeeAll}
            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
          >
            All badges
          </button>
          <button type="button" onClick={onNext} autoFocus className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
            {last ? "Awesome!" : "Next"}
          </button>
        </div>
      </motion.div>
    </Backdrop>
  );
};

// ============================================================
// Last week's league result
// ============================================================

const RESULT_COPY = {
  promote: (to: string) => ({ title: `You moved up to ${to}!`, line: "Brilliant week. A new league, new rivals." }),
  stay: (to: string) => ({ title: `You stay in ${to}`, line: "A solid week. A little more XP gets you into the promotion zone." }),
  demote: (to: string) => ({ title: `You moved down to ${to}`, line: "It happens to everyone. One good week brings you straight back." }),
} as const;

const PODIUM_COLORS = ["#d4a017", "#8a94a6", "#b4733c"];

const LeagueResult: React.FC<{ result: NonNullable<Celebrations["league"]>; reduced: boolean; onClose: () => void; onOpen: () => void }> = ({
  result,
  reduced,
  onClose,
  onOpen,
}) => {
  const { user } = useAuth();
  const copy = RESULT_COPY[result.result](result.to.name);
  const podium = result.rank !== null && result.rank <= 3 && result.xp > 0;
  const moved = result.from.index !== result.to.index;
  return (
    <Backdrop onClose={onClose} label="Last week's league results">
      {!reduced && result.result === "promote" && <Confetti colors={[result.to.color, result.from.color, "#f59e0b", "#6366f1"]} />}
      <motion.div
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-panel p-7 text-center shadow-2xl"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Last week's results</p>

        <motion.div
          className="mx-auto mt-5 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white"
          style={{ background: podium ? PODIUM_COLORS[(result.rank as number) - 1] : result.from.color }}
          initial={reduced ? false : { scale: 0.3 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.1 }}
        >
          {podium ? <Medal className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
          <span className="text-2xl font-bold tabular-nums leading-none mt-0.5">#{result.rank ?? "–"}</span>
        </motion.div>
        <p className="mt-3 text-sm text-slate-500">
          of {result.groupSize} in the {result.from.name} league · {result.xp.toLocaleString()} XP
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: result.from.color }} title={result.from.name}>
            <Trophy className="w-5 h-5" />
          </span>
          {moved ? (
            <>
              <motion.span initial={reduced ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                {result.result === "promote" ? <ArrowUp className="w-5 h-5 text-emerald-500 rotate-90" /> : <ArrowDown className="w-5 h-5 text-rose-500 -rotate-90" />}
              </motion.span>
              <motion.span
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                style={{ background: result.to.color }}
                title={result.to.name}
                initial={reduced ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.7 }}
              >
                <Trophy className="w-6 h-6" />
              </motion.span>
            </>
          ) : null}
        </div>

        <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">{copy.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{copy.line}</p>

        {(result.result === "promote" || podium) && (
          <ShareCardButton
            variant="soft"
            label="Share this result"
            className="mt-5 w-full"
            card={{
              kind: "league",
              person: user?.name ?? "A SpeakBetter learner",
              league: result.result === "promote" ? result.to.name : result.from.name,
              color: result.result === "promote" ? result.to.color : result.from.color,
              rank: result.rank,
              groupSize: result.groupSize,
              xp: result.xp,
              result: result.result,
            }}
          />
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onOpen}
            autoFocus
            className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
          >
            This week <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </Backdrop>
  );
};

// ============================================================
// Weekly quest chest
// ============================================================

const Card: React.FC<{ reduced: boolean; children: React.ReactNode }> = ({ reduced, children }) => (
  <motion.div
    className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-panel p-7 text-center shadow-2xl"
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.92 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 260, damping: 22 }}
  >
    {children}
  </motion.div>
);

const ChestOpen: React.FC<{ quests: WeeklyQuests; reduced: boolean; onClose: () => void }> = ({ quests, reduced, onClose }) => (
  <Backdrop onClose={onClose} label="Weekly quests complete">
    {!reduced && <Confetti colors={["#f59e0b", "#f97316", "#facc15", "#0ea5e9", "#6366f1"]} />}
    <Card reduced={reduced}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
        <X className="w-4 h-4" />
      </button>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Weekly quests complete</p>
      {/* The box shakes, then bursts open */}
      <motion.div
        className="mx-auto mt-5 w-28 h-28 rounded-[28px] bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/15"
        initial={reduced ? false : { scale: 0.4, rotate: 0 }}
        animate={reduced ? undefined : { scale: [0.4, 1, 1, 1, 1, 1.12, 1], rotate: [0, 0, -10, 10, -8, 0, 0] }}
        transition={{ duration: 1.3, times: [0, 0.25, 0.4, 0.55, 0.7, 0.85, 1] }}
      >
        <Gift className="w-14 h-14" />
      </motion.div>
      <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">Chest opened!</h2>
      <p className="mt-1 text-sm text-slate-500">You finished all {quests.total} quests this week.</p>
      <div className="mt-5 flex justify-center gap-2">
        <motion.span
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-300"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.2 }}
        >
          <Zap className="w-4 h-4" /> +{quests.chest.xp} XP
        </motion.span>
        {quests.chest.freezeGiven && (
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-500/10 px-3 py-1.5 text-sm font-bold text-sky-700 dark:text-sky-300"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.45 }}
          >
            <Snowflake className="w-4 h-4" /> +1 streak freeze
          </motion.span>
        )}
      </div>
      {!quests.chest.freezeGiven && <p className="mt-3 text-xs text-slate-400">You already hold the most streak freezes, so this chest was all XP.</p>}
      <button type="button" onClick={onClose} autoFocus className="mt-6 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
        Brilliant!
      </button>
    </Card>
  </Backdrop>
);

// ============================================================
// Streak saved by a freeze
// ============================================================

const weekday = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
};

const StreakSaved: React.FC<{ status: StreakStatus; reduced: boolean; onClose: () => void }> = ({ status, reduced, onClose }) => {
  const days = status.saved.map((s) => weekday(s.day));
  const covered = days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}` : days[0];
  return (
    <Backdrop onClose={onClose} label="Your streak was saved">
      {!reduced && <Confetti colors={["#e0f2fe", "#7dd3fc", "#38bdf8", "#ffffff", "#bae6fd"]} />}
      <Card reduced={reduced}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Streak freeze used</p>
        <div className="relative mx-auto mt-5 w-28 h-28">
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center"
            initial={reduced ? false : { scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          >
            <Flame className="w-14 h-14 fill-white/30" />
          </motion.div>
          {/* The ice settles over the flame and keeps it */}
          <motion.div
            className="absolute -right-2 -bottom-2 w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/15 ring-4 ring-white dark:ring-panel"
            initial={reduced ? false : { scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.4 }}
          >
            <Snowflake className="w-6 h-6" />
          </motion.div>
        </div>
        <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">Your streak was saved</h2>
        <p className="mt-1 text-sm text-slate-500">
          {days.length > 1 ? "Freezes" : "A freeze"} covered {covered}, so your {status.current}-day streak lives on.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          {status.freezes > 0
            ? `You still hold ${status.freezes} ${status.freezes === 1 ? "freeze" : "freezes"}.`
            : "No freezes left. Get another from your weekly quests, or for XP on the dashboard."}
        </p>
        <button type="button" onClick={onClose} autoFocus className="mt-6 w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
          {status.practicedToday ? "Nice" : "Practise today"}
        </button>
      </Card>
    </Backdrop>
  );
};

// ============================================================
// Layer
// ============================================================

/** Mounted once for the whole app. `paused` keeps it out of the way (for example inside a voice room). */
export const CelebrationLayer: React.FC<{ paused?: boolean }> = ({ paused }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = Boolean(useReducedMotion());
  const active = !!user && !paused;
  const { data } = useCelebrations(active);
  const { data: quests } = useQuests(active);
  const { data: streak } = useStreak(active);
  const mark = useMarkCelebrated();
  const markQuestNews = useMarkQuestNews();
  const [badgeIndex, setBadgeIndex] = useState(0);

  if (paused || !data) return null;

  const finishBadges = () => {
    setBadgeIndex(0);
    mark.mutate({ badges: true });
  };

  let content: React.ReactNode = null;
  if (data.league) {
    content = (
      <LeagueResult
        key="league"
        result={data.league}
        reduced={reduced}
        onClose={() => mark.mutate({ league: true })}
        onOpen={() => {
          mark.mutate({ league: true });
          navigate("/leagues");
        }}
      />
    );
  } else if (streak && streak.saved.length) {
    content = (
      <StreakSaved
        key="saved"
        status={streak}
        reduced={reduced}
        onClose={() => {
          markQuestNews.mutate({ saved: true });
          if (!streak.practicedToday) navigate("/dashboard");
        }}
      />
    );
  } else if (quests?.celebrate) {
    content = <ChestOpen key="chest" quests={quests} reduced={reduced} onClose={() => markQuestNews.mutate({ chest: true })} />;
  } else if (data.badges.length) {
    const index = Math.min(badgeIndex, data.badges.length - 1);
    content = (
      <BadgeReveal
        key={data.badges[index].key}
        badge={data.badges[index]}
        position={{ index, total: data.badges.length }}
        reduced={reduced}
        onNext={() => (index + 1 < data.badges.length ? setBadgeIndex(index + 1) : finishBadges())}
        onSeeAll={() => {
          finishBadges();
          navigate("/leagues?tab=badges");
        }}
      />
    );
  }

  return <AnimatePresence>{content}</AnimatePresence>;
};

export default CelebrationLayer;
