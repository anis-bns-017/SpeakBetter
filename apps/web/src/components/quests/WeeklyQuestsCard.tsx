// apps/web/src/components/quests/WeeklyQuestsCard.tsx
/**
 * This week's three quests, the chest for finishing them all, and the streak freezes you hold (with the
 * shop to get another). Quests tick off from anything you do in the app.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  AudioLines,
  CalendarCheck,
  CheckCircle2,
  Gift,
  Layers,
  Library,
  PenLine,
  ListChecks,
  Loader2,
  Megaphone,
  Mic,
  Snowflake,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { timeLeft } from "../../hooks/useGamification";
import { useBuyFreeze, useQuests, useStreak, type Quest, type QuestKind } from "../../hooks/useQuests";
import { useT } from "../../i18n";
import { tr, msg } from "../../i18n/core";

const KIND: Record<QuestKind, { icon: LucideIcon; tone: string; bar: string }> = {
  XP: { icon: Zap, tone: "bg-amber-500/10 text-amber-500", bar: "bg-amber-500" },
  DAYS: { icon: CalendarCheck, tone: "bg-orange-500/10 text-orange-500", bar: "bg-orange-500" },
  PLAN: { icon: ListChecks, tone: "bg-indigo-500/10 text-indigo-500", bar: "bg-indigo-500" },
  SPEAK: { icon: Mic, tone: "bg-indigo-500/10 text-indigo-500", bar: "bg-indigo-500" },
  REVIEW: { icon: Layers, tone: "bg-sky-500/10 text-sky-500", bar: "bg-sky-500" },
  READ: { icon: Library, tone: "bg-teal-500/10 text-teal-500", bar: "bg-teal-500" },
  WRITE: { icon: PenLine, tone: "bg-indigo-500/10 text-indigo-500", bar: "bg-indigo-500" },
  CHALLENGE: { icon: Megaphone, tone: "bg-rose-500/10 text-rose-500", bar: "bg-rose-500" },
  PRONUNCIATION: { icon: AudioLines, tone: "bg-cyan-500/10 text-cyan-500", bar: "bg-cyan-500" },
  CORRECTION: { icon: Wand2, tone: "bg-violet-500/10 text-violet-500", bar: "bg-violet-500" },
};

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** The server writes quest titles in English; in other languages they are rebuilt from the kind and target */
const QUEST_TITLE: Record<QuestKind, string> = {
  XP: msg("Earn {n} XP"),
  DAYS: msg("Practise on {n} different days"),
  PLAN: msg("Finish your daily plan on {n} days"),
  SPEAK: msg("Speak for {n} minutes"),
  REVIEW: msg("Review {n} cards"),
  READ: msg("Read {n} texts in the library"),
  WRITE: msg("Finish {n} pieces in the Writing studio"),
  CHALLENGE: msg("Answer {n} daily challenges"),
  PRONUNCIATION: msg("Do {n} pronunciation tries"),
  CORRECTION: msg("Give {n} corrections"),
};

const QuestRow: React.FC<{ quest: Quest }> = ({ quest }) => {
  const { t, lang } = useT();
  const title = lang === "en" ? quest.title : t(QUEST_TITLE[quest.kind], { n: quest.target });
  const unit = quest.kind === "XP" ? " XP" : quest.kind === "SPEAK" ? ` ${t("min")}` : "";
  const amount = `${quest.progress.toLocaleString()} / ${quest.target.toLocaleString()}${unit}`;
  const kind = KIND[quest.kind];
  const Icon = kind.icon;
  const pct = Math.round((quest.progress / Math.max(1, quest.target)) * 100);
  const body = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${quest.done ? "bg-emerald-500/10 text-emerald-500" : kind.tone}`}>
        {quest.done ? <CheckCircle2 className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-sm font-semibold leading-snug ${quest.done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900 dark:text-slate-100"}`}>
            {tr(title)}
          </span>
          <span className={`text-[11px] font-semibold shrink-0 mt-0.5 ${quest.done ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
            {quest.done ? t("Done") : `+${quest.xp} XP`}
          </span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
            <span className={`block h-full rounded-full transition-[width] duration-700 ${quest.done ? "bg-emerald-500" : kind.bar}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{amount}</span>
        </span>
      </span>
    </>
  );
  return quest.to && !quest.done ? (
    <Link to={quest.to} className="flex items-center gap-3 rounded-2xl p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-2 -mx-2">{body}</div>
  );
};

/** Two slots, filled for each freeze you hold */
const FreezeSlots: React.FC<{ have: number; max: number; label: string }> = ({ have, max, label }) => (
  <span className="flex gap-1" aria-label={tr(label)}>
    {Array.from({ length: max }, (_, i) => (
      <span
        key={i}
        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          i < have ? "bg-sky-500 text-white shadow-md shadow-sky-500/15" : "bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600"
        }`}
      >
        <Snowflake className="w-4 h-4" />
      </span>
    ))}
  </span>
);

export const WeeklyQuestsCard: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { data, isLoading, isError } = useQuests();
  const { data: streak } = useStreak();
  const buy = useBuyFreeze();
  const { t, lang } = useT();
  const [now, setNow] = useState(() => Date.now());
  const seenDone = useRef<Set<string> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // A small cheer for each quest that ticks off while you are here (the chest gets the big one)
  useEffect(() => {
    if (!data) return;
    const done = new Set(data.quests.filter((q) => q.done).map((q) => q.id));
    const before = seenDone.current;
    if (before && data.done < data.total) {
      for (const q of data.quests) if (q.done && !before.has(q.id)) toast.success(t("Quest done: {title}. +{xp} XP", { title: lang === "en" ? q.title : t(QUEST_TITLE[q.kind], { n: q.target }), xp: q.xp }), { icon: "🎯" });
    }
    seenDone.current = done;
  }, [data, t, lang]);

  if (isLoading) {
    return (
      <section className={`${card} p-6 ${className}`}>
        <div className="h-5 w-36 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }
  if (isError || !data) return null;

  const opened = !!data.chest.openedAt;
  const onBuy = () =>
    buy.mutate(undefined, {
      onSuccess: () => toast.success(t("Streak freeze ready. A missed day won't break your streak."), { icon: "❄️" }),
      onError: (e) => toast.error(errorMessage(e, t("Couldn't get a freeze. Try again."))),
    });

  return (
    <section className={`${card} p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/15">
            <Gift className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t("Weekly quests")}</h2>
            <p className="text-xs text-slate-500">
              {t("{done} of {total} done · {time} left", { done: data.done, total: data.total, time: timeLeft(data.endsAt, now) })}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {data.quests.map((q) => (
          <QuestRow key={q.id} quest={q} />
        ))}
      </div>

      <div
        className={`mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
          opened ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-amber-50 dark:bg-amber-500/10"
        }`}
      >
        <Gift className={`w-5 h-5 shrink-0 ${opened ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
        <p className="text-xs text-slate-700 dark:text-slate-200">
          {opened ? (
            <>
              <span className="font-semibold">{t("Chest opened:")}</span>{" "}
              {data.chest.freezeGiven
                ? t("+{xp} XP and a streak freeze. New quests on Monday.", { xp: data.chest.xp })
                : t("+{xp} XP. New quests on Monday.", { xp: data.chest.xp })}
            </>
          ) : (
            <>
              {t("Finish all {n} for a chest:", { n: data.total })}{" "}
              <span className="font-semibold">{t("+{xp} XP and a streak freeze", { xp: data.chest.xp })}</span>
            </>
          )}
        </p>
      </div>

      {streak && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <FreezeSlots have={streak.freezes} max={streak.maxFreezes} label={t("{have} of {max} streak freezes", { have: streak.freezes, max: streak.maxFreezes })} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {t("Streak freezes")} {streak.freezes}/{streak.maxFreezes}
              </p>
              <p className="text-[11px] text-slate-500 leading-snug">
                {streak.freezes > 0 ? t("Miss a day and one is used, so your streak lives on.") : t("Each one covers a day you miss.")}
              </p>
            </div>
          </div>
          {streak.freezes < streak.maxFreezes && (
            <button
              type="button"
              onClick={onBuy}
              disabled={!streak.canBuy || buy.isPending}
              className="mt-3 w-full h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-white/5 dark:disabled:text-slate-500"
            >
              {buy.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Snowflake className="w-3.5 h-3.5" />}
              {t("Get a freeze for {price} XP", { price: streak.price })}
            </button>
          )}
          {streak.freezes < streak.maxFreezes && !streak.canBuy && (
            <p className="mt-2 text-[11px] text-slate-400">
              {streak.balance >= streak.price
                ? t("Practise once today to start a streak, then you can get one.")
                : t("{balance} XP to spend. Earn {more} more, or finish your quests for a free one.", {
                    balance: streak.balance.toLocaleString(),
                    more: streak.price - streak.balance,
                  })}
            </p>
          )}
          {streak.freezes < streak.maxFreezes && streak.canBuy && (
            <p className="mt-2 text-[11px] text-slate-400">
              {t("Buying spends {price} of your {balance} XP to spend. Your level and league keep every XP you earned.", {
                price: streak.price,
                balance: streak.balance.toLocaleString(),
              })}
            </p>
          )}
        </div>
      )}

      <Link to="/leagues?tab=badges" className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1">
        {t("Quest badges")} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
};

export default WeeklyQuestsCard;
