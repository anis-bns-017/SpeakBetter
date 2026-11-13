// apps/web/src/pages/WelcomePage.tsx
/**
 * The first-day guide, shown once to new accounts (ProtectedRoute sends them here while profile.onboardedAt is
 * empty). Five short steps, each skippable: home language (and, for Bangla speakers, the app in Bangla), why
 * they're learning, their level (the real test, or a quick guess), a daily goal, and one clear first thing to do.
 * Progress survives a trip to the level test (sessionStorage), so the test can sit in the middle of the guide.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Briefcase,
  Check,
  ClipboardCheck,
  Drama,
  GraduationCap,
  Heart,
  Loader2,
  MessagesSquare,
  Plane,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../lib/api/client";
import { useAuth } from "../contexts/useAuth";
import { useT } from "../i18n";
import { EchoMascot } from "../components/dashboard/EchoMascot";
import { useTrendingRooms } from "../hooks/useDiscovery";
import { tr, msg } from "../i18n/core";

const STATE_KEY = "sb.welcome";

const HOME_LANGUAGES: Array<{ code: string; native: string; name: string }> = [
  { code: "bn", native: "বাংলা", name: "Bangla" },
  { code: "hi", native: "हिन्दी", name: "Hindi" },
  { code: "ur", native: "اردو", name: "Urdu" },
  { code: "ar", native: "العربية", name: "Arabic" },
  { code: "es", native: "Español", name: "Spanish" },
  { code: "pt", native: "Português", name: "Portuguese" },
  { code: "zh", native: "中文", name: "Chinese" },
  { code: "vi", native: "Tiếng Việt", name: "Vietnamese" },
  { code: "id", native: "Bahasa Indonesia", name: "Indonesian" },
  { code: "tr", native: "Türkçe", name: "Turkish" },
  { code: "ru", native: "Русский", name: "Russian" },
  { code: "fr", native: "Français", name: "French" },
  { code: "ja", native: "日本語", name: "Japanese" },
  { code: "ko", native: "한국어", name: "Korean" },
  { code: "other", native: "Other", name: "Another language" },
];

const GOALS: Array<{ id: string; icon: LucideIcon; title: string; text: string }> = [
  { id: "speaking", icon: MessagesSquare, title: msg("Speak with confidence"), text: msg("Stop freezing, start talking") },
  { id: "work", icon: Briefcase, title: msg("My job or career"), text: msg("Meetings, interviews, emails") },
  { id: "study", icon: GraduationCap, title: msg("Study abroad"), text: msg("University and student life") },
  { id: "exam", icon: Trophy, title: msg("Pass an exam"), text: msg("IELTS, TOEFL and more") },
  { id: "travel", icon: Plane, title: msg("Travel"), text: msg("Get around and make friends") },
  { id: "friends", icon: Heart, title: msg("Meet people"), text: msg("Chat with learners worldwide") },
];

const SELF_LEVELS: Array<{ id: string; title: string; text: string }> = [
  { id: "beginner", title: msg("I'm just starting"), text: msg("I know a few words") },
  { id: "basic", title: msg("I know the basics"), text: msg("Simple sentences, slowly") },
  { id: "intermediate", title: msg("I can have a conversation"), text: msg("With some mistakes") },
  { id: "confident", title: msg("I'm fairly confident"), text: msg("I want to sound natural") },
];

const DAILY: Array<{ minutes: number; title: string; text: string }> = [
  { minutes: 5, title: msg("Easy"), text: msg("5 minutes a day") },
  { minutes: 10, title: msg("Steady"), text: msg("10 minutes a day") },
  { minutes: 20, title: msg("Serious"), text: msg("20 minutes a day") },
  { minutes: 30, title: msg("Intense"), text: msg("30 minutes a day") },
];

interface Answers {
  step: number;
  nativeLanguage: string | null;
  goals: string[];
  selfLevel: string | null;
  tookTest: boolean;
  dailyGoalMinutes: number | null;
}

const EMPTY: Answers = { step: 0, nativeLanguage: null, goals: [], selfLevel: null, tookTest: false, dailyGoalMinutes: 10 };

const readState = (): Answers => {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

const choice = (selected: boolean) =>
  `relative w-full rounded-2xl border p-4 text-left transition-[background-color,border-color,transform] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
    selected
      ? "border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-400/15"
      : "border-line bg-surface hover:border-slate-300 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
  }`;

const Tick: React.FC<{ on: boolean }> = ({ on }) =>
  on ? (
    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
      <Check aria-hidden className="h-3 w-3" />
    </span>
  ) : null;

export const WelcomePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t, lang, setLang } = useT();
  const navigate = useNavigate();
  const reduced = Boolean(useReducedMotion());
  // Start from the home language picked on the sign-up form, when it's one of ours (English isn't offered here)
  const [a, setA] = useState<Answers>(() => {
    const saved = readState();
    const fromSignUp = user?.profile?.nativeLanguage;
    return !saved.nativeLanguage && fromSignUp && HOME_LANGUAGES.some((l) => l.code === fromSignUp) ? { ...saved, nativeLanguage: fromSignUp } : saved;
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { data: trending } = useTrendingRooms(6);
  const liveRoom = useMemo(() => (Array.isArray(trending) ? trending : []).find((r) => r && r.isLive !== false && (r.participantCount ?? 0) > 0), [trending]);
  const firstName = (user?.name || "").split(" ")[0];
  const steps = 4;

  // Coming back from the level test: that step is done
  const testLevel = (user as { profile?: { level?: string | null; levelAssessedAt?: string | null } } | null)?.profile;
  useEffect(() => {
    if (a.step !== 2) return;
    // The test saved a level on the server; read the fresh profile to see it
    let live = true;
    void refreshUser().then((fresh) => {
      const assessed = (fresh as { profile?: { levelAssessedAt?: string | null } } | null)?.profile?.levelAssessedAt;
      if (live && assessed) setA((s) => ({ ...s, tookTest: true, step: 3 }));
    });
    return () => {
      live = false;
    };
    // Only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(a));
    } catch {
      /* the guide still works, it just won't survive the test trip */
    }
  }, [a]);

  const go = (step: number) => setA((s) => ({ ...s, step }));

  const finish = async (skipRest = false) => {
    setSaving(true);
    try {
      await apiClient.put("/profile/me/onboarding", {
        ...(a.nativeLanguage ? { nativeLanguage: a.nativeLanguage } : {}),
        ...(a.goals.length ? { goals: a.goals } : {}),
        ...(a.selfLevel && !a.tookTest ? { selfLevel: a.selfLevel } : {}),
        ...(!skipRest && a.dailyGoalMinutes ? { dailyGoalMinutes: a.dailyGoalMinutes } : {}),
        interfaceLanguage: lang,
      });
      try {
        sessionStorage.removeItem(STATE_KEY);
      } catch {
        /* fine */
      }
      await refreshUser();
      if (skipRest) navigate("/dashboard", { replace: true });
      else setDone(true);
    } catch {
      toast.error(t("That didn't save. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  const takeTest = () => {
    setA((s) => ({ ...s, step: 2 }));
    navigate("/placement?from=welcome");
  };

  const firstSteps = [
    liveRoom
      ? { icon: AudioLines, title: t("Listen in a live room"), text: t("“{name}” is live now. Just listen; nobody will make you speak.", { name: liveRoom.name ?? "" }), to: `/voice/${liveRoom.id}` }
      : { icon: AudioLines, title: t("Visit the voice rooms"), text: t("See who's talking, or set a reminder for the next room."), to: "/voice" },
    { icon: Drama, title: t("Try a 2-minute role-play"), text: t("Order a coffee, check into a hotel. Say it out loud."), to: "/roleplay" },
    { icon: ClipboardCheck, title: t("Look around your dashboard"), text: t("Your plan for today, your streak and today's word."), to: "/dashboard" },
  ];

  const slide = reduced
    ? {}
    : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.25, ease: "easeOut" as const } };

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-1.5" aria-label={t("Step {n} of {total}", { n: Math.min(a.step + 1, steps), total: steps })}>
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${done || i <= a.step ? "w-8 bg-indigo-600 dark:bg-indigo-400" : "w-4 bg-slate-200 dark:bg-white/10"}`} />
          ))}
        </div>
        {!done && (
          <button
            type="button"
            onClick={() => void finish(true)}
            disabled={saving}
            className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-900/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            {t("Skip for now")}
          </button>
        )}
      </header>

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.section key="done" {...slide} className="flex flex-1 flex-col">
              <div className="relative overflow-hidden rounded-[32px] bg-indigo-900 p-6 text-white sm:p-8">
                <div className="flex items-center gap-4">
                  <EchoMascot mood="cheer" scope="welcome" reduced={reduced} lines={[t("Small steps, every day. That's the whole secret.")]} className="w-24 shrink-0 sm:w-28" />
                  <div>
                    <p className="t-eyebrow text-white/70">{t("You're all set")}</p>
                    <h1 className="mt-1 text-[28px] leading-tight sm:text-[36px]">{t("Let's say your first sentence.")}</h1>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">{t("Pick one to start. You can do the others any time.")}</p>
              <ul className="mt-3 space-y-3">
                {firstSteps.map((s) => (
                  <li key={s.to}>
                    <button type="button" onClick={() => navigate(s.to, { replace: true })} className={`${choice(false)} flex items-center gap-4`}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
                        <s.icon aria-hidden className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900 dark:text-white">{tr(s.title)}</span>
                        <span className="block text-sm text-slate-600 dark:text-slate-400">{tr(s.text)}</span>
                      </span>
                      <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.section>
          ) : a.step === 0 ? (
            <motion.section key="lang" {...slide}>
              <div className="flex items-center gap-4">
                <div className="w-20 shrink-0 rounded-3xl bg-indigo-900 p-2">
                  <EchoMascot mood="idle" scope="welcome" reduced={reduced} lines={[t("Hi! I'm Echo. I'll help you get started.")]} greeting={t("Hi! I'm Echo. I'll help you get started.")} className="w-full" />
                </div>
                <div>
                  <p className="t-eyebrow text-indigo-700 dark:text-indigo-300">{t("Welcome{name}", { name: firstName ? `, ${firstName}` : "" })}</p>
                  <h1 className="mt-1 text-[28px] leading-tight text-slate-900 sm:text-[34px] dark:text-white">{t("Which language do you speak at home?")}</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t("It helps us explain words and set up translations for you.")}</p>
              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {HOME_LANGUAGES.map((l) => {
                  const on = a.nativeLanguage === l.code;
                  return (
                    <button key={l.code} type="button" aria-pressed={on} onClick={() => setA((s) => ({ ...s, nativeLanguage: l.code }))} className={`${choice(on)} !p-3.5`}>
                      <Tick on={on} />
                      <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">{l.code === "other" ? t("Other") : l.native}</span>
                      <span className="block text-xs text-slate-500">{t(l.name)}</span>
                    </button>
                  );
                })}
              </div>
              {a.nativeLanguage === "bn" && (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-400/25 dark:bg-indigo-400/10">
                  <p className="text-sm text-slate-800 dark:text-slate-100">
                    <span className="font-semibold">বাংলায় অ্যাপটি দেখবেন?</span> {t("Buttons and help in Bangla, practice in English.")}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" aria-pressed={lang === "bn"} onClick={() => setLang("bn")} className={`h-10 rounded-xl px-4 text-sm font-semibold ${lang === "bn" ? "bg-indigo-600 text-white" : "border border-line bg-surface text-slate-700 dark:text-slate-200"}`}>
                      বাংলা
                    </button>
                    <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} className={`h-10 rounded-xl px-4 text-sm font-semibold ${lang === "en" ? "bg-indigo-600 text-white" : "border border-line bg-surface text-slate-700 dark:text-slate-200"}`}>
                      {tr("English")}</button>
                  </div>
                </div>
              )}
              <Nav onNext={() => go(1)} nextLabel={t("Continue")} />
            </motion.section>
          ) : a.step === 1 ? (
            <motion.section key="goals" {...slide}>
              <h1 className="text-[28px] leading-tight text-slate-900 sm:text-[34px] dark:text-white">{t("Why are you learning English?")}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("Pick as many as you like. We'll suggest rooms and lessons to match.")}</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const on = a.goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setA((s) => ({ ...s, goals: on ? s.goals.filter((x) => x !== g.id) : [...s.goals, g.id] }))}
                      className={`${choice(on)} flex items-center gap-3`}
                    >
                      <Tick on={on} />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                        <g.icon aria-hidden className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-white">{t(g.title)}</span>
                        <span className="block text-sm text-slate-600 dark:text-slate-400">{t(g.text)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Nav onBack={() => go(0)} onNext={() => go(2)} nextLabel={t("Continue")} backLabel={t("Back")} />
            </motion.section>
          ) : a.step === 2 ? (
            <motion.section key="level" {...slide}>
              <h1 className="text-[28px] leading-tight text-slate-900 sm:text-[34px] dark:text-white">{t("How much English do you know?")}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("The level test is the best way to know. It takes about 8 minutes.")}</p>
              <button type="button" onClick={takeTest} className={`${choice(false)} mt-6 flex items-center gap-4 !border-indigo-600 dark:!border-indigo-400`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                  <Sparkles aria-hidden className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-slate-900 dark:text-white">{t("Take the 8-minute level test")}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400">{t("Recommended. You'll come back here when it's done.")}</span>
                </span>
                <ArrowRight aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              </button>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Or choose for now")}</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {SELF_LEVELS.map((l) => {
                  const on = a.selfLevel === l.id;
                  return (
                    <button key={l.id} type="button" aria-pressed={on} onClick={() => setA((s) => ({ ...s, selfLevel: l.id }))} className={choice(on)}>
                      <Tick on={on} />
                      <span className="block font-semibold text-slate-900 dark:text-white">{t(l.title)}</span>
                      <span className="block text-sm text-slate-600 dark:text-slate-400">{t(l.text)}</span>
                    </button>
                  );
                })}
              </div>
              <Nav onBack={() => go(1)} onNext={() => go(3)} nextLabel={t("Continue")} backLabel={t("Back")} />
            </motion.section>
          ) : (
            <motion.section key="goal" {...slide}>
              {a.tookTest && (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                  <Check aria-hidden className="h-4 w-4" /> {t("Level test done")}
                  {testLevel?.level ? ` · ${testLevel.level}` : ""}
                </p>
              )}
              <h1 className="text-[28px] leading-tight text-slate-900 sm:text-[34px] dark:text-white">{t("How much time each day?")}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("Little and often beats a lot once a week. You can change this any time.")}</p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {DAILY.map((d) => {
                  const on = a.dailyGoalMinutes === d.minutes;
                  return (
                    <button key={d.minutes} type="button" aria-pressed={on} onClick={() => setA((s) => ({ ...s, dailyGoalMinutes: d.minutes }))} className={choice(on)}>
                      <Tick on={on} />
                      <span className="block font-display text-[28px] font-semibold leading-none text-slate-900 dark:text-white">{d.minutes}</span>
                      <span className="mt-1 block font-semibold text-slate-900 dark:text-white">{t(d.title)}</span>
                      <span className="block text-sm text-slate-600 dark:text-slate-400">{t(d.text)}</span>
                    </button>
                  );
                })}
              </div>
              <Nav onBack={() => go(2)} onNext={() => void finish()} nextLabel={saving ? t("Saving…") : t("Finish")} backLabel={t("Back")} busy={saving} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const Nav: React.FC<{ onBack?: () => void; onNext: () => void; nextLabel: string; backLabel?: string; busy?: boolean }> = ({ onBack, onNext, nextLabel, backLabel, busy }) => (
  <div className="mt-8 flex items-center justify-between gap-3">
    {onBack ? (
      <button type="button" onClick={onBack} className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-900/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.06]">
        <ArrowLeft aria-hidden className="h-4 w-4" /> {backLabel}
      </button>
    ) : (
      <span />
    )}
    <button
      type="button"
      onClick={onNext}
      disabled={busy}
      className="inline-flex h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-6 text-[15px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {nextLabel} {!busy && <ArrowRight aria-hidden className="h-4 w-4" />}
    </button>
  </div>
);

export default WelcomePage;
