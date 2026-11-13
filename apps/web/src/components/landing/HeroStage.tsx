// apps/web/src/components/landing/HeroStage.tsx
/**
 * The landing page's hero picture, made of real UI rather than a screenshot: a small live voice room where
 * someone says a sentence, the caption appears, and a gentle correction slides in. It cycles through a few
 * everyday mistakes, and Echo reacts in the corner. One animated scene per page; everything else stays still.
 * With reduced motion, it shows one sentence and its correction, without movement.
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, Users } from "lucide-react";
import { EchoMascot } from "../dashboard/EchoMascot";
import { tr, msg } from "../../i18n/core";

const MOMENTS = [
  { who: "Aarav", said: ["Yesterday I", "goed", "to the market."], fix: "went", note: msg("Past of go") },
  { who: "Lucía", said: ["She", "don't", "like rainy days."], fix: "doesn't", note: msg("He / she / it") },
  { who: "Minh", said: ["I", "am agree", "with you."], fix: "I agree", note: msg("No “am” before agree") },
];

const SPEAKERS = [
  { name: "Aarav", tone: "bg-amber-300 text-amber-950" },
  { name: "Lucía", tone: "bg-rose-300 text-rose-950" },
  { name: "Minh", tone: "bg-sky-300 text-sky-950" },
  { name: "You", tone: "bg-white text-indigo-900" },
];

const BARS = [20, 34, 26, 48, 38, 64, 50, 82, 58, 92, 66, 100, 72, 86, 56, 74, 44, 62, 34, 50, 26, 38, 20, 30];

export const HeroStage: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const [index, setIndex] = useState(0);
  const [talking, setTalking] = useState(false);
  const moment = MOMENTS[index];

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % MOMENTS.length), 4200);
    return () => window.clearInterval(t);
  }, [reduced]);

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[32px] bg-indigo-900 p-5 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-rose-400 ${reduced ? "" : "animate-ping"} opacity-75`} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
            </span>
            {tr("Live · Weekend plans (B1)")}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
            <Users aria-hidden className="h-3.5 w-3.5" /> {" "}{tr("4 in the room")}</span>
        </div>

        {/* Who's in the room; the speaker's ring pulses */}
        <ul className="mt-6 flex gap-3">
          {SPEAKERS.map((s) => {
            const speaking = s.name === moment.who;
            return (
              <li key={s.name} className="flex flex-col items-center gap-1.5">
                <span className="relative">
                  {speaking && !reduced && <span aria-hidden className="absolute -inset-1.5 animate-ping rounded-full bg-amber-300/30" />}
                  <span
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ring-2 transition-[box-shadow] sm:h-12 sm:w-12 ${s.tone} ${speaking ? "ring-amber-300" : "ring-transparent"}`}
                  >
                    {s.name[0]}
                  </span>
                </span>
                <span className="text-[11px] text-white/70">{s.name}</span>
              </li>
            );
          })}
        </ul>

        {/* The caption, with the mistake marked, then the correction */}
        <div className="mt-6 min-h-[132px] sm:min-h-[120px]" aria-live="off">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <p className="flex items-center gap-1.5 text-xs text-white/60">
                <Mic aria-hidden className="h-3.5 w-3.5" /> {moment.who} {" "}{tr("is speaking")}</p>
              <p className="mt-1.5 text-lg leading-snug sm:text-xl">
                “{moment.said[0]}{" "}
                <span className="rounded-md bg-rose-400/25 px-1 text-rose-100 line-through decoration-rose-300/80 decoration-2">{moment.said[1]}</span>{" "}
                {moment.said[2]}”
              </p>
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={reduced ? undefined : { type: "spring", stiffness: 320, damping: 22, delay: 1.1 }}
                style={{ originX: 0 }}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-indigo-950 shadow-lg"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check aria-hidden className="h-3 w-3" />
                </span>
                <span className="font-semibold">{moment.fix}</span>
                <span className="text-xs text-slate-500">· {tr(moment.note)}</span>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* The room's voice */}
        <div aria-hidden className={`mt-4 flex h-12 items-end gap-[5px] opacity-70 ${reduced ? "" : "echo-talking"}`}>
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`echo-bar max-w-[8px] flex-1 rounded-full ${i % 7 === 3 ? "bg-amber-300/80" : "bg-white/20"}`}
              style={{ height: `${h}%`, animationDelay: `${-((i * 137) % 900)}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Echo watches from the corner and talks back when tapped */}
      <EchoMascot
        mood="idle"
        scope="landing"
        reduced={reduced}
        greeting="Hi! I'm Echo. Tap me for a speaking tip."
        lines={[
          "Mistakes are just practice with feedback.",
          "Say one sentence out loud right now. Any sentence.",
          "Ten minutes a day beats an hour on Sunday.",
          "Shadowing tip: copy the rhythm first, the words second.",
        ]}
        onTalkingChange={setTalking}
        className={`!absolute -bottom-10 -right-2 w-[104px] drop-shadow-[0_10px_18px_rgba(18,26,59,0.25)] sm:-right-6 sm:w-[132px] ${talking ? "z-20" : "z-10"}`}
      />
    </div>
  );
};

export default HeroStage;
