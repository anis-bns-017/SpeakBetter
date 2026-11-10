// apps/web/src/pages/LeaguesPage.tsx
/**
 * Leagues and badges. Each week you compete with up to 29 other learners in your league for XP: the top of
 * the group moves up a league, the bottom moves down. Badges mark milestones across the whole app.
 */

import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clock, Crown, Info, Loader2, Lock, Pin, PinOff, Trophy, UserPlus } from "lucide-react";
import {
  timeLeft,
  useAchievements,
  useCurrentLeague,
  useFriendsLeague,
  usePinBadge,
  type Badge,
  type BadgeCategory,
  type CurrentLeague,
  type LeagueStanding,
} from "../hooks/useGamification";
import { useAuth } from "../contexts/AuthContext";
import { BadgeIcon } from "../components/gamification/BadgeIcon";
import { ShareCardButton } from "../components/gamification/ShareCardDialog";
import { TIER_STYLE } from "../components/gamification/tiers";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  STREAK: "Showing up",
  LEARNING: "Learning",
  SPEAKING: "Speaking",
  VOCABULARY: "Words & review",
  COMMUNITY: "Helping others",
  SPECIAL: "Leagues",
};
const CATEGORY_ORDER: BadgeCategory[] = ["STREAK", "LEARNING", "SPEAKING", "VOCABULARY", "COMMUNITY", "SPECIAL"];

// ============================================================
// League
// ============================================================

/** The ten leagues as a row of gems, with yours lit up */
const Ladder: React.FC<{ league: CurrentLeague }> = ({ league }) => (
  <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="League ladder">
    {league.leagues.map((l) => {
      const mine = l.index === league.tier.index;
      const reached = l.index <= league.tier.index;
      return (
        <div key={l.index} className="flex flex-col items-center gap-1 shrink-0 w-14" title={`${l.name} league`}>
          <span
            className={`flex items-center justify-center rounded-2xl transition-all ${mine ? "w-12 h-12 shadow-lg" : "w-9 h-9"}`}
            style={reached ? { background: l.color, color: "#fff" } : undefined}
          >
            {reached ? (
              mine ? <Crown className="w-6 h-6" /> : <Trophy className="w-4 h-4" />
            ) : (
              <span className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              </span>
            )}
          </span>
          <span className={`text-[11px] ${mine ? "font-bold text-slate-900 dark:text-white" : "text-slate-400"}`}>{l.name}</span>
        </div>
      );
    })}
  </div>
);

const Row: React.FC<{ s: LeagueStanding }> = ({ s }) => (
  <li
    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${
      s.isMe ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200 dark:ring-indigo-500/30" : ""
    }`}
  >
    <span
      className={`w-7 text-center text-sm font-bold tabular-nums ${
        s.zone === "promote" ? "text-emerald-600 dark:text-emerald-400" : s.zone === "demote" ? "text-rose-600 dark:text-rose-400" : "text-slate-500"
      }`}
    >
      {s.rank}
    </span>
    {s.avatarUrl ? (
      <img src={s.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
    ) : (
      <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
        {s.name.charAt(0).toUpperCase()}
      </span>
    )}
    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
      <Link to={`/u/${s.userId}`} className="hover:underline">{s.isMe ? "You" : s.name}</Link>
    </span>
    <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{s.xp.toLocaleString()} XP</span>
  </li>
);

const LeagueView: React.FC = () => {
  const { data, isLoading, isError } = useCurrentLeague();
  // Captured once per render pass of this view; the countdown only needs minute precision
  const [now] = useState(() => Date.now());

  if (isLoading) return <Spinner />;
  if (isError || !data) return <Failed what="your league" />;

  const promoteLine = data.promote;
  const demoteStart = data.standings.length - data.demote;
  const last = data.lastResult;

  return (
    <div className="space-y-5">
      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">This week</p>
            <h2 className="mt-1 text-2xl font-bold" style={{ color: data.tier.color }}>
              {data.tier.name} league
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {data.joined
                ? `You're #${data.myRank} of ${data.standings.length}`
                : "Earn any XP this week to join a group"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5" /> Ends in {timeLeft(data.endsAt, now)}
          </span>
        </div>
        <div className="mt-4">
          <Ladder league={data} />
        </div>
      </section>

      {last && last.result && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm flex items-center gap-2 ${
            last.result === "promote"
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : last.result === "demote"
                ? "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200"
                : "bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200"
          }`}
        >
          {last.result === "promote" ? <ArrowUp className="w-4 h-4" /> : last.result === "demote" ? <ArrowDown className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          Last week: #{last.rank} in {last.league} with {last.xp ?? 0} XP ·{" "}
          {last.result === "promote" ? "promoted" : last.result === "demote" ? "moved down" : "stayed"}
        </div>
      )}

      {data.joined ? (
        <section className={`${card} p-3 sm:p-4`}>
          <ol className="space-y-0.5">
            {data.standings.map((s, i) => (
              <React.Fragment key={s.userId}>
                {i === promoteLine && promoteLine > 0 && (
                  <li className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400" aria-hidden>
                    <ArrowUp className="w-3 h-3" /> Promotion zone above
                    <span className="flex-1 border-t border-dashed border-emerald-300 dark:border-emerald-500/40" />
                  </li>
                )}
                {i === demoteStart && data.demote > 0 && (
                  <li className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400" aria-hidden>
                    <ArrowDown className="w-3 h-3" /> Demotion zone below
                    <span className="flex-1 border-t border-dashed border-rose-300 dark:border-rose-500/40" />
                  </li>
                )}
                <Row s={s} />
              </React.Fragment>
            ))}
          </ol>
        </section>
      ) : (
        <section className={`${card} p-8 text-center`}>
          <Trophy className="w-10 h-10 mx-auto" style={{ color: data.tier.color }} />
          <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">Join this week's {data.tier.name} league</p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Earn any XP (a review, a pronunciation try, a few minutes of speaking) and you'll be placed in a group of up to 30 learners.
          </p>
          <Link to="/dashboard" className="mt-4 inline-flex h-10 px-4 items-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
            Do today's plan
          </Link>
        </section>
      )}

      <p className="text-xs text-slate-500 text-center max-w-md mx-auto">
        Weeks run Monday to Sunday. In a full group the top 7 move up a league and the bottom 5 move down; smaller groups move fewer.
        Finishing the week with no XP moves you down.
      </p>
    </div>
  );
};

// ============================================================
// Friends
// ============================================================

/** This week's XP among you, your friends and the people you follow, whatever league they are in */
const FriendsView: React.FC = () => {
  const { data, isLoading, isError } = useFriendsLeague();
  const [now] = useState(() => Date.now());
  if (isLoading) return <Spinner />;
  if (isError || !data) return <Failed what="your friends' scores" />;

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">This week</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">You and your friends</h2>
          <p className="text-sm text-slate-500">Friends and people you follow, by XP this week</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5" /> Resets in {timeLeft(data.endsAt, now)}
        </span>
      </section>

      <section className={`${card} p-3 sm:p-4`}>
        <ol className="space-y-0.5">
          {data.people.map((p) => (
            <li
              key={p.userId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${p.isMe ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200 dark:ring-indigo-500/30" : ""}`}
            >
              <span className="w-7 text-center text-sm font-bold tabular-nums text-slate-500">{p.rank}</span>
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"><Link to={`/u/${p.userId}`} className="hover:underline">{p.isMe ? "You" : p.name}</Link></span>
                <span className="block text-[11px] font-semibold" style={{ color: p.leagueColor }}>
                  {p.league} league
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{p.xp.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      </section>

      {!data.hasFriends && (
        <section className={`${card} p-6 text-center`}>
          <UserPlus className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">It's just you so far</p>
          <p className="mt-1 text-sm text-slate-500">Add friends or follow people to see how you compare each week.</p>
          <Link to="/suggestions" className="mt-4 inline-flex h-10 px-4 items-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
            Find people
          </Link>
        </section>
      )}
    </div>
  );
};

// ============================================================
// Badges
// ============================================================

const BadgeTile: React.FC<{ b: Badge; person: string; pinFull: boolean }> = ({ b, person, pinFull }) => {
  const earned = !!b.earnedAt;
  const pin = usePinBadge();
  const togglePin = () =>
    pin.mutate(
      { key: b.key, pinned: !b.pinned },
      { onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Couldn't change the pin. Try again.") },
    );
  const pct = Math.round((b.progress.value / b.progress.target) * 100);
  return (
    <div className={`${card} p-4 flex items-start gap-3 ${earned ? "" : "opacity-90"}`}>
      <BadgeIcon icon={b.icon} tier={b.tier} earned={earned} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-sm font-semibold ${earned ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>{b.name}</p>
          {b.isNew && <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white">New</span>}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{b.description}</p>
        {earned ? (
          <>
            <p className="text-[11px] mt-1.5" style={{ color: TIER_STYLE[b.tier].ring }}>
              {TIER_STYLE[b.tier].label} · earned {new Date(b.earnedAt as string).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={togglePin}
                aria-pressed={b.pinned}
                disabled={pin.isPending || (!b.pinned && pinFull)}
                title={!b.pinned && pinFull ? "You can pin up to 6. Unpin one first." : undefined}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  b.pinned
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-400/15 dark:text-indigo-200"
                    : "border-line bg-surface text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                }`}
              >
                {b.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
                {b.pinned ? "Pinned" : "Pin"}
                <span className="sr-only">{b.pinned ? ` ${b.name}, tap to unpin` : ` ${b.name} to your profile`}</span>
              </button>
              <ShareCardButton
                size="sm"
                label="Share"
                card={{ kind: "badge", person, name: b.name, description: b.description, tier: b.tier, icon: b.icon }}
                className="!h-8 !px-2.5 text-xs"
              />
            </div>
          </>
        ) : (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
              {b.progress.value.toLocaleString()} / {b.progress.target.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const BadgesView: React.FC = () => {
  const { data, isLoading, isError } = useAchievements();
  const { user } = useAuth();
  const groups = useMemo(() => {
    if (!data) return [];
    return CATEGORY_ORDER.map((c) => ({
      category: c,
      // Earned first, then the ones you are closest to
      badges: data.badges
        .filter((b) => b.category === c)
        .sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt) || b.progress.value / b.progress.target - a.progress.value / a.progress.target),
    })).filter((g) => g.badges.length);
  }, [data]);

  if (isLoading) return <Spinner />;
  if (isError || !data) return <Failed what="your badges" />;

  return (
    <div className="space-y-6">
      <section className={`${card} p-5 flex flex-wrap items-center gap-4`}>
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {data.earned}
            <span className="text-base font-semibold text-slate-400"> of {data.total}</span>
          </p>
          <p className="text-xs text-slate-500">badges earned</p>
        </div>
        {data.earned > 0 && (
          <p className="text-xs text-slate-500 max-w-[16rem]">
            Pinned {data.pinnedCount} of {data.maxPinned}. Pinned badges come first on your profile.
          </p>
        )}
        {data.recent.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">Latest</span>
            {data.recent.map((b) => (
              <span key={b.key} title={b.name}>
                <BadgeIcon icon={b.icon} tier={b.tier} earned size={36} />
              </span>
            ))}
          </div>
        )}
      </section>

      {groups.map((g) => (
        <section key={g.category}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{CATEGORY_LABEL[g.category]}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {g.badges.map((b) => (
              <BadgeTile key={b.key} b={b} person={user?.name ?? "A SpeakBetter learner"} pinFull={data.pinnedCount >= data.maxPinned} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

// ============================================================
// Page
// ============================================================

const Spinner = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
  </div>
);

const Failed: React.FC<{ what: string }> = ({ what }) => (
  <div className={`${card} p-8 text-center text-sm text-slate-500`}>Couldn't load {what}. Refresh the page to try again.</div>
);

export const LeaguesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = requested === "badges" || requested === "friends" ? requested : "league";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
          <Trophy className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">Leagues</h1>
          <p className="text-sm text-slate-500">Climb the weekly leagues and collect badges as you learn</p>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] w-fit" role="tablist">
        {(["league", "friends", "badges"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams(t === "league" ? {} : { tab: t }, { replace: true })}
            className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {t === "league" ? "This week" : t === "friends" ? "Friends" : "Badges"}
          </button>
        ))}
      </div>

      {tab === "league" ? <LeagueView /> : tab === "friends" ? <FriendsView /> : <BadgesView />}
    </div>
  );
};

export default LeaguesPage;
