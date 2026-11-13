// apps/web/src/pages/LandingPage.tsx
/**
 * The front door for visitors who aren't signed in. It explains SpeakBetter honestly (only what the app really
 * does, no made-up numbers), shows it working in the hero, and leads to one action: start free.
 * One animated scene (the hero); the rest of the page settles in quietly as you scroll.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  Brain,
  Check,
  Flag,
  Flame,
  Headphones,
  Layers,
  Mic,
  PenLine,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Trophy,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { HeroStage } from "../components/landing/HeroStage";
import { SiteFooter, SiteNav } from "../components/landing/SiteChrome";
import { tr, msg } from "../i18n/core";

/** Settles a block in once, as it scrolls into view */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="t-eyebrow text-indigo-700 dark:text-indigo-300">{children}</p>;

const tile = "rounded-[28px] border border-line bg-surface p-6 shadow-sm";

const Feature: React.FC<{ icon: LucideIcon; title: string; text: string; tone: string; children?: React.ReactNode; className?: string }> = ({
  icon: Icon,
  title,
  text,
  tone,
  children,
  className,
}) => (
  <div className={`${tile} flex flex-col ${className ?? ""}`}>
    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
      <Icon aria-hidden className="h-5 w-5" />
    </span>
    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{tr(title)}</h3>
    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tr(text)}</p>
    {children && <div className="mt-5 flex-1">{children}</div>}
  </div>
);

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Is SpeakBetter free?",
    a: "Yes. Voice rooms, random calls, chat, lessons, the library, the dictionary, flashcards, pronunciation and writing practice are all free. There is an optional Pro plan inside the app with extras.",
  },
  {
    q: "My English isn't good yet. Is it for me?",
    a: "Yes. A short level test (A1 to C2) points you to rooms, lessons and word packs at your level. In voice rooms you can just listen first, and raise your hand when you're ready.",
  },
  {
    q: "Who will I talk to?",
    a: "Other people learning English. Rooms are hosted by learners and grouped by topic and level, and random calls match you with someone at a similar level.",
  },
  {
    q: "Is it safe to talk to strangers?",
    a: "You can block anyone, report a person or a message in two taps, and leave a room or call at any time. Our moderators review reports, and accounts that break the rules are suspended.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. SpeakBetter works in the browser on phones and computers, and you can add it to your home screen like an app. Lessons and the library you've opened keep working offline.",
  },
  {
    q: "What happens to my voice?",
    a: "Voice rooms and calls are live and not recorded. When you practise pronunciation, your recording is checked on your own device and never uploaded.",
  },
];

export const LandingPage: React.FC = () => {
  const reduced = Boolean(useReducedMotion());

  // Arriving right after deleting an account: say goodbye once, then tidy the address
  const [goodbye, setGoodbye] = useState(() => new URLSearchParams(window.location.search).has("goodbye"));
  useEffect(() => {
    if (goodbye) window.history.replaceState(null, "", "/");
  }, [goodbye]);

  // The tab and search title for the front door; other pages keep "SpeakBetter"
  useEffect(() => {
    const previous = document.title;
    document.title = "SpeakBetter: speak English out loud, every day";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-page text-slate-900 dark:text-white">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        {tr("Skip to content")}</a>
      <SiteNav sections />
      {goodbye && (
        <div role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p>{tr("Your account and everything in it have been deleted. Thanks for practising with us; you're always welcome back.")}</p>
            <button type="button" onClick={() => setGoodbye(false)} className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-400/15">
              {tr("Close")}</button>
          </div>
        </div>
      )}

      <main id="top">
        {/* ================= Hero ================= */}
        <section className="relative overflow-hidden">
          {/* A quiet lapis wash behind the hero, nothing louder */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-indigo-100/70 to-transparent dark:from-indigo-500/10" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
            <div>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs dark:text-slate-200"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-amber-500" /> {" "}{tr("English practice that talks back")}</motion.p>
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
                className="mt-5 text-[44px] leading-[1.02] tracking-tight sm:text-[64px]"
              >
                {tr("Speak English")}<br />
                <span className="italic text-indigo-700 dark:text-indigo-300">{tr("out loud,")}</span> {" "}{tr("every day.")}</motion.h1>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
                className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {tr("Join live voice rooms and calls with other learners. Your mistakes turn into quick reviews, timed to how you remember, so the right words are there when you need them.")}</motion.p>
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-[15px] font-semibold text-white shadow-md transition-[background-color,transform] hover:bg-indigo-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  {tr("Start speaking free")}{" "}<ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-2xl px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-900/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.06]">
                  {tr("I already have an account")}</Link>
              </motion.div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                {["Free to use", "Phone or computer", "Levels A1 to C2"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check aria-hidden className="h-4 w-4 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 24, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.15 }}
              className="mx-auto w-full max-w-lg lg:mr-6"
            >
              <HeroStage reduced={reduced} />
            </motion.div>
          </div>
        </section>

        {/* ================= Features ================= */}
        <section id="features" className="scroll-mt-20 border-t border-line/70 bg-surface/40 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>{tr("Everything in one place")}</Eyebrow>
              <h2 className="font-display mt-3 text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">{tr("Talk, then make it stick.")}</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
                {tr("Speaking is the center of SpeakBetter. Everything else is there to help you say the next sentence better than the last one.")}</p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-6">
              <Reveal className="md:col-span-4">
                <Feature
                  icon={AudioLines}
                  tone="bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  title={tr("Live voice rooms and random calls")}
                  text="Drop into a room on a topic you like, or get matched with one learner for a quick call. Listen first, raise your hand when you're ready, and get gentle corrections from the room."
                  className="h-full"
                >
                  <div className="flex flex-wrap gap-2">
                    {["Weekend plans · B1", "Job interviews · B2", "Movies · A2", "Travel stories · B1"].map((r, i) => (
                      <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-page px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />}
                        {r}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                      <Phone aria-hidden className="h-3 w-3" /> {" "}{tr("Random call")}</span>
                  </div>
                </Feature>
              </Reveal>

              <Reveal className="md:col-span-2" delay={0.05}>
                <Feature
                  icon={Brain}
                  tone="bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  title={tr("Reviews timed to your memory")}
                  text="Corrections and new words become flashcards. They come back just before you'd forget them, and the timing learns how fast you forget."
                  className="h-full"
                >
                  <div className="rounded-2xl border border-line bg-page p-3 text-sm">
                    <p className="text-slate-500 line-through">{tr("I goed home")}</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">{tr("I went home")}</p>
                    <p className="mt-2 text-xs text-slate-500">{tr("Next review in 3 days")}</p>
                  </div>
                </Feature>
              </Reveal>

              <Reveal className="md:col-span-2" delay={0.05}>
                <Feature
                  icon={Mic}
                  tone="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                  title={tr("Pronunciation, sound by sound")}
                  text="Say a word or sentence and see which sounds came out right. The check runs on your device, so your recording stays with you."
                  className="h-full"
                >
                  <div className="flex gap-1 font-mono text-sm" aria-label={tr("The sounds of think: th, i, ng, k. The th sounded like s.")}>
                    <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">θ</span>
                    {["ɪ", "ŋ", "k"].map((p) => (
                      <span key={p} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{tr("“think”: the th sounded like s")}</p>
                </Feature>
              </Reveal>

              <Reveal className="md:col-span-2" delay={0.1}>
                <Feature
                  icon={BookOpenText}
                  tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  title={tr("Read, listen and look things up")}
                  text="Stories and articles from A1 to C2 that read themselves aloud, a 13,000-word dictionary, and a tap-to-translate on any word."
                  className="h-full"
                />
              </Reveal>

              <Reveal className="md:col-span-2" delay={0.15}>
                <Feature
                  icon={PenLine}
                  tone="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                  title={tr("Writing, checked")}
                  text="Write a few lines on a daily prompt and get your grammar and spelling checked, with the fixes saved for review."
                  className="h-full"
                />
              </Reveal>

              <Reveal className="md:col-span-6" delay={0.05}>
                <div className={`${tile} grid gap-6 md:grid-cols-[1fr_auto] md:items-center`}>
                  <div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <Flame aria-hidden className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{tr("A reason to come back tomorrow")}</h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {tr("A daily plan sized to your goal, a streak you can protect, weekly quests, a daily speaking challenge and friendly leagues. Small, steady steps are how speaking gets easy.")}</p>
                  </div>
                  <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 md:grid-cols-2">
                    {[
                      { icon: Target, label: msg("Daily plan") },
                      { icon: Flame, label: msg("Streaks") },
                      { icon: Layers, label: msg("Word packs") },
                      { icon: Trophy, label: msg("Leagues") },
                    ].map(({ icon: Icon, label }) => (
                      <li key={label} className="flex items-center gap-2 rounded-xl border border-line bg-page px-3 py-2 text-slate-700 dark:text-slate-300">
                        <Icon aria-hidden className="h-4 w-4 text-slate-400" /> {tr(label)}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= How it works ================= */}
        <section id="how" className="scroll-mt-20 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>{tr("How it works")}</Eyebrow>
              <h2 className="font-display mt-3 text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">{tr("Three steps, ten minutes a day.")}</h2>
            </Reveal>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                { icon: Target, title: msg("Find your level"), text: msg("A short test places you from A1 to C2, so everything you see fits where you are.") },
                { icon: Headphones, title: msg("Speak a little, daily"), text: msg("Join a room, take a call, or shadow a short dialogue. Listening first counts too.") },
                { icon: Brain, title: msg("Review what you got wrong"), text: msg("Your own mistakes come back as quick cards, right before you'd forget them.") },
              ].map((s, i) => (
                <Reveal key={s.title} delay={i * 0.07}>
                  <li className={`${tile} h-full`}>
                    <span className="font-display text-[44px] font-semibold leading-none text-indigo-200 dark:text-indigo-400/40">{i + 1}</span>
                    <h3 className="mt-4 flex items-center gap-2 text-lg font-semibold">
                      <s.icon aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {tr(s.title)}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tr(s.text)}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= Safety ================= */}
        <section id="safety" className="scroll-mt-20 border-y border-line/70 bg-surface/40 py-20 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <Eyebrow>{tr("Safe to speak up")}</Eyebrow>
              <h2 className="font-display mt-3 text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">{tr("Kind rooms, real people, a team that watches out.")}</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
                {tr("Talking to strangers takes courage. These are always one tap away, and people who make others feel unwelcome are removed.")}</p>
            </Reveal>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Flag, title: msg("Report in two taps"), text: msg("A person or a single message, from a room, chat or call.") },
                { icon: UserX, title: msg("Block anyone"), text: msg("They can't call you, message you or find you again.") },
                { icon: ShieldCheck, title: msg("Moderators review reports"), text: msg("Rule-breakers are warned, suspended or removed.") },
                { icon: Smartphone, title: msg("Your voice stays live"), text: msg("Rooms and calls aren't recorded. Pronunciation checks run on your device.") },
              ].map((s, i) => (
                <Reveal key={s.title} delay={i * 0.05}>
                  <li className={`${tile} h-full !p-5`}>
                    <s.icon aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                    <p className="mt-3 font-semibold">{tr(s.title)}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tr(s.text)}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="scroll-mt-20 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>{tr("Questions")}</Eyebrow>
              <h2 className="font-display mt-3 text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">{tr("Before you start")}</h2>
            </Reveal>
            <div className="mt-10 divide-y divide-line rounded-[28px] border border-line bg-surface">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-[16px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    {item.q}
                    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg leading-none text-slate-600 transition-transform group-open:rotate-45 dark:bg-white/[0.06] dark:text-slate-300">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ================= Final call ================= */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-[36px] bg-indigo-900 px-6 py-14 text-center text-white ring-1 ring-inset ring-white/10 sm:px-12 sm:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center gap-[6px] px-8 opacity-40">
                {[18, 30, 24, 44, 34, 60, 46, 80, 54, 92, 62, 100, 68, 84, 52, 70, 40, 56, 30, 44, 22, 32, 16, 24].map((h, i) => (
                  <span key={i} className={`w-[6px] rounded-full ${i % 6 === 3 ? "bg-amber-300" : "bg-white/40"}`} style={{ height: `${h}%` }} />
                ))}
              </div>
              <h2 className="font-display relative text-[34px] font-semibold leading-tight tracking-tight sm:text-[52px]">
                {tr("Your next sentence")}<br />
                <span className="italic text-amber-300">{tr("starts here.")}</span>
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-white/80">{tr("Make an account in a minute, take the level test, and say hello in your first room today.")}</p>
              <Link
                to="/register"
                className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-semibold text-indigo-900 shadow-md hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
              >
                {tr("Start speaking free")}{" "}<ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default LandingPage;
