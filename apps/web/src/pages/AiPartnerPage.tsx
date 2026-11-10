/**
 * AiPartnerPage — talk to an AI partner that stays at your level.
 *
 * You speak (browser speech recognition) or type; the partner answers out loud (browser
 * text-to-speech) and, under each of your turns, shows what to fix, a more natural way to say it,
 * and a few words worth saving. Ending the conversation gives a recap. The model runs on the server:
 * this page never sees an API key, and every turn is limited per conversation and per day.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  BookmarkPlus,
  Bot,
  Check,
  Gauge,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import {
  fetchTutorSession,
  tutorErrorMessage,
  useEndTutorSession,
  useStartTutorSession,
  useTutorStatus,
  useTutorTurn,
  type TutorMessage,
  type TutorScenarioInfo,
  type TutorSession,
  type TutorStatus,
  type TutorSummary,
} from "../hooks/useAiTutor";
import useWordBank from "../hooks/useWordBank";
import { useMySubscription } from "../hooks/useBilling";
import { WordLookup, readSelection, type WordSelection } from "../components/chat/WordLookup";
import { CEFR_CODES, CEFR_INFO, isCefr, type CefrCode } from "../lib/cefr";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { speechCaptionsSupported, useSpeechCaptions } from "../components/call/useSpeechCaptions";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

/** Silence after you stop talking before your words are sent (hands-free mode) */
const AUTO_SEND_MS = 1800;
const PREFS_KEY = "speakbetter:ai-partner:prefs";

interface Prefs {
  voice: boolean;
  slow: boolean;
  autoSend: boolean;
}

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return { voice: raw.voice !== false, slow: raw.slow === true, autoSend: raw.autoSend !== false };
  } catch {
    return { voice: true, slow: false, autoSend: true };
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // remembering choices is a convenience only
  }
}

const speakAloud = (text: string, slow: boolean) => speak(text, { rate: slow ? 0.7 : 0.9 });

// ============================================================
// Setup
// ============================================================

const Setup: React.FC<{
  status: TutorStatus;
  starting: boolean;
  resuming: boolean;
  onStart: (scenario: string, level: CefrCode) => void;
  onResume: () => void;
}> = ({ status, starting, resuming, onStart, onResume }) => {
  const [scenario, setScenario] = useState<TutorScenarioInfo["id"]>(status.scenarios[0]?.id ?? "free");
  const [level, setLevel] = useState<CefrCode>(
    isCefr(status.level) ? (status.level.toUpperCase() as CefrCode) : "B1",
  );
  const hasLevel = isCefr(status.level);
  const outOfTurns = status.dailyTurnsLeft <= 0;
  const onFreePlan = useMySubscription().data?.plan === "FREE";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/15">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-5">AI speaking partner</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto">
          Practise real conversations any time. Your partner speaks at your level, and after each thing you say you see what to fix and how to say it more naturally.
        </p>
      </div>

      {!status.configured && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200">
          The AI partner isn't switched on yet. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to <code className="font-mono">server/.env</code> and restart the server.
        </div>
      )}

      {status.activeSessionId && (
        <button
          type="button"
          onClick={onResume}
          disabled={resuming}
          className={`${card} mt-6 w-full p-4 flex items-center justify-between gap-3 text-left hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60`}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Continue your last conversation</span>
            <span className="block text-xs text-slate-500">You didn't finish it. Pick up where you left off.</span>
          </span>
          {resuming ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <ArrowRight className="w-5 h-5 text-indigo-500" />}
        </button>
      )}

      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mt-8 mb-3">What do you want to practise?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {status.scenarios.map((s) => {
          const active = scenario === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              aria-pressed={active}
              className={`p-4 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                active
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm"
                  : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-2xl" aria-hidden>{s.emoji}</span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mt-2">{s.title}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{s.blurb}</span>
            </button>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mt-8 mb-3">Your level</h2>
      <div className="flex flex-wrap gap-2">
        {CEFR_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLevel(code)}
            aria-pressed={level === code}
            title={CEFR_INFO[code].name}
            className={`h-10 px-4 rounded-xl border text-sm font-semibold transition-colors ${
              level === code
                ? "border-indigo-500 bg-indigo-600 text-white"
                : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {code}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {hasLevel ? (
          <>From your placement test. {CEFR_INFO[level].name}: {CEFR_INFO[level].summary}</>
        ) : (
          <>
            Not sure? <Link to="/placement" className="text-indigo-500 font-medium hover:underline">Take the 8-minute level test</Link>. {CEFR_INFO[level].name}: {CEFR_INFO[level].summary}
          </>
        )}
      </p>

      <button
        type="button"
        onClick={() => onStart(scenario, level)}
        disabled={starting || !status.configured || outOfTurns}
        className="mt-8 w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        Start talking
      </button>
      <p className="text-center text-xs text-slate-400 mt-3">
        {outOfTurns ? "You've used all of today's practice turns. Come back tomorrow!" : `${status.dailyTurnsLeft} practice turns left today`}
        {onFreePlan && (
          <>
            {" · "}
            <Link to="/premium" className="font-medium text-indigo-500 hover:text-indigo-600">
              Get more with Pro
            </Link>
          </>
        )}
        {!speechCaptionsSupported() && " · Voice input needs Chrome or Edge. You can type instead."}
      </p>
    </div>
  );
};

// ============================================================
// Conversation
// ============================================================

const IconButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: LucideIcon;
}> = ({ label, active, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={label}
    title={label}
    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
      active
        ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
    }`}
  >
    <Icon className="w-[18px] h-[18px]" />
  </button>
);

const Bubble: React.FC<{
  message: TutorMessage;
  emoji: string;
  slow: boolean;
  isLast: boolean;
  isSaved: (word: string) => boolean;
  onSaveWord: (word: string, meaning: string, sentence: string) => void;
  onSuggestion: (text: string) => void;
}> = ({ message: m, emoji, slow, isLast, isSaved, onSaveWord, onSuggestion }) => {
  if (m.role === "assistant") {
    return (
      <div className="flex gap-2.5 max-w-[88%]">
        <span className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0 text-base" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0">
          <div className="rounded-2xl rounded-tl-md bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.07] px-4 py-2.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100" data-message-text={m.text}>
            {m.text}
            {canSpeak() && (
              <button
                type="button"
                onClick={() => void speakAloud(m.text, slow)}
                aria-label="Hear it again"
                title="Hear it again"
                className="ml-2 inline-flex align-middle text-slate-400 hover:text-indigo-500"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {m.newWords && m.newWords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.newWords.map((w) => {
                const saved = isSaved(w.word);
                return (
                  <button
                    key={w.word}
                    type="button"
                    disabled={saved}
                    onClick={() => onSaveWord(w.word, w.meaning, w.example || m.text)}
                    title={`${w.meaning}${w.example ? ` — “${w.example}”` : ""}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-70"
                  >
                    {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                    <span className="font-semibold">{w.word}</span>
                    <span className="text-emerald-600/80 dark:text-emerald-300/70">{w.meaning}</span>
                  </button>
                );
              })}
            </div>
          )}
          {isLast && m.suggestions && m.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSuggestion(s)}
                  className="px-3 py-1.5 rounded-full text-xs border border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const clean = !m.pending && (m.corrections?.length ?? 0) === 0 && !m.betterPhrasing;
  return (
    <div className="flex flex-col items-end">
      <div className={`max-w-[88%] rounded-2xl rounded-tr-md bg-indigo-600 text-white px-4 py-2.5 text-[15px] leading-relaxed ${m.pending ? "opacity-70" : ""}`} data-message-text={m.text}>
        {m.text}
      </div>
      <div className="max-w-[88%] w-full sm:w-auto">
        {m.corrections?.map((c) => (
          <div key={c.original} className="mt-2 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5 text-sm">
            <p className="text-slate-800 dark:text-slate-100">
              <span className="line-through text-rose-500">{c.original}</span>
              <ArrowRight className="inline w-3.5 h-3.5 mx-1.5 text-slate-400" />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.corrected}</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{c.explanation}</p>
          </div>
        ))}
        {m.betterPhrasing && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
            <span>
              More natural: “{m.betterPhrasing}”
              {canSpeak() && (
                <button type="button" onClick={() => void speakAloud(m.betterPhrasing ?? "", slow)} aria-label="Hear it" className="ml-1.5 inline-flex align-middle text-slate-400 hover:text-indigo-500">
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          </p>
        )}
        {clean && (
          <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
            <Check className="w-3.5 h-3.5" /> Sounds good
          </p>
        )}
      </div>
    </div>
  );
};

const Conversation: React.FC<{
  initial: TutorSession;
  onEnded: (summary: TutorSummary, scenarioTitle: string) => void;
}> = ({ initial, onEnded }) => {
  const turn = useTutorTurn(initial.sessionId);
  const end = useEndTutorSession(initial.sessionId);
  const wordBank = useWordBank(true);
  const { mutateAsync: sendTurn } = turn;

  const [prefs, setPrefs] = useState(loadPrefs);
  const [messages, setMessages] = useState<TutorMessage[]>(initial.messages);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "speaking">("idle");
  const [turnsLeft, setTurnsLeft] = useState(initial.turnsLeftToday);

  const draftRef = useRef("");
  const interimRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);
  const sendingRef = useRef(false);
  const prefsRef = useRef(prefs);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  // Select a word or phrase in any message to see what it means in your language
  const [selected, setSelected] = useState<WordSelection | null>(null);
  const onSelectionEnd = useCallback(() => {
    // Let the browser finish updating the selection first
    window.setTimeout(() => {
      const next = readSelection(messagesRef.current);
      if (next) setSelected(next);
    }, 0);
  }, []);
  const micSupported = speechCaptionsSupported();

  useEffect(() => {
    prefsRef.current = prefs;
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      stopSpeaking();
    },
    [],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text || sendingRef.current) return;
      sendingRef.current = true;
      window.clearTimeout(timerRef.current);
      draftRef.current = "";
      interimRef.current = "";
      setDraft("");
      setInterim("");

      const tempId = `pending-${Date.now()}`;
      setMessages((m) => [...m, { id: tempId, role: "user", text, pending: true }]);
      setPhase("thinking");
      try {
        const reply = await sendTurn(text);
        setMessages((m) => [...m.filter((x) => x.id !== tempId), reply.userMessage, reply.reply]);
        setTurnsLeft(reply.turnsLeftToday);
        if (prefsRef.current.voice && canSpeak()) {
          setPhase("speaking");
          await speakAloud(reply.reply.text, prefsRef.current.slow);
        }
      } catch (error) {
        // Put the words back so nothing you said is lost
        setMessages((m) => m.filter((x) => x.id !== tempId));
        draftRef.current = text;
        setDraft(text);
        toast.error(tutorErrorMessage(error, "Couldn't reach your partner. Please try again."));
      } finally {
        sendingRef.current = false;
        setPhase("idle");
      }
    },
    [sendTurn],
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // The mic only listens while the partner is neither thinking nor talking, so it never hears itself
  const { error: micError } = useSpeechCaptions({
    active: micOn && phase === "idle",
    onText: (text, final) => {
      window.clearTimeout(timerRef.current);
      if (final) {
        draftRef.current = `${draftRef.current} ${text}`.trim();
        interimRef.current = "";
        setDraft(draftRef.current);
        setInterim("");
        if (prefsRef.current.autoSend) {
          timerRef.current = window.setTimeout(() => void sendRef.current(draftRef.current), AUTO_SEND_MS);
        }
      } else {
        interimRef.current = text;
        setInterim(text);
      }
    },
  });

  const toggleMic = () => {
    if (micOn) {
      // Keep the half-finished phrase the browser hadn't confirmed yet
      window.clearTimeout(timerRef.current);
      if (interimRef.current) {
        draftRef.current = `${draftRef.current} ${interimRef.current}`.trim();
        setDraft(draftRef.current);
        interimRef.current = "";
        setInterim("");
      }
    }
    setMicOn((on) => !on);
  };

  const sendNow = () => void send(`${draftRef.current} ${interimRef.current}`);

  const finish = async () => {
    window.clearTimeout(timerRef.current);
    stopSpeaking();
    setMicOn(false);
    try {
      const { summary } = await end.mutateAsync();
      onEnded(summary, initial.scenario.title);
    } catch (error) {
      toast.error(tutorErrorMessage(error, "Couldn't finish the conversation. Please try again."));
    }
  };

  const busy = phase !== "idle";
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const userTurns = messages.filter((m) => m.role === "user").length;
  const listening = micOn && phase === "idle";

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--tabbar-h,0px))] max-w-3xl mx-auto w-full">
      {/* ---------- header ---------- */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-white/[0.07]">
        <span className="text-2xl" aria-hidden>{initial.scenario.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-slate-900 dark:text-white truncate">{initial.scenario.title}</h1>
          <p className="text-xs text-slate-500">
            {initial.level} · {turnsLeft} turns left today
          </p>
        </div>
        <IconButton
          label={prefs.voice ? "Partner voice on" : "Partner voice off"}
          active={prefs.voice}
          icon={prefs.voice ? Volume2 : VolumeX}
          onClick={() => {
            if (prefs.voice) stopSpeaking();
            setPrefs((p) => ({ ...p, voice: !p.voice }));
          }}
        />
        <IconButton label="Speak slowly" active={prefs.slow} icon={Gauge} onClick={() => setPrefs((p) => ({ ...p, slow: !p.slow }))} />
        <button
          type="button"
          onClick={finish}
          disabled={end.isPending || busy}
          className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50 flex items-center gap-1.5"
        >
          {end.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Finish
        </button>
      </header>

      {/* ---------- messages ---------- */}
      <div
        ref={messagesRef}
        onMouseUp={onSelectionEnd}
        onTouchEnd={onSelectionEnd}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4"
        aria-live="polite"
      >
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            emoji={initial.scenario.emoji}
            slow={prefs.slow}
            isLast={m.id === lastAssistantId && phase === "idle"}
            isSaved={(w) => wordBank.savedSet.has(w.toLowerCase())}
            onSaveWord={(word, meaning, sentence) => void wordBank.save({ word, meaning, sentence })}
            onSuggestion={(s) => {
              draftRef.current = s;
              setDraft(s);
            }}
          />
        ))}
        {phase === "thinking" && (
          <div className="flex gap-2.5">
            <span className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-base" aria-hidden>
              {initial.scenario.emoji}
            </span>
            <div className="rounded-2xl rounded-tl-md bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.07] px-4 py-3 flex gap-1.5" role="status" aria-label="Your partner is thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {phase === "speaking" && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Speaking…
            <button type="button" onClick={() => stopSpeaking()} className="underline hover:text-slate-600">Skip</button>
          </p>
        )}
        <div ref={bottomRef} />
        <AnimatePresence>
          {selected && (
            <WordLookup key={`${selected.text}-${selected.rect.top}`} selection={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* ---------- composer ---------- */}
      <footer className="px-4 sm:px-6 pt-3 pb-4 border-t border-slate-200/80 dark:border-white/[0.07]">
        {micError && <p className="text-sm text-rose-500 mb-2">{micError}</p>}
        {listening && (
          <p className="text-xs text-rose-500 font-semibold mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Listening… {prefs.autoSend ? "pause when you're done and I'll send it" : "press send when you're done"}
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!micSupported}
            aria-pressed={micOn}
            aria-label={micOn ? "Turn the microphone off" : "Turn the microphone on"}
            title={micSupported ? (micOn ? "Turn the microphone off" : "Speak") : "Voice input needs Chrome or Edge"}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 ${
              micOn ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {micOn ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <textarea
            value={interim ? `${draft} ${interim}`.trim() : draft}
            onChange={(e) => {
              window.clearTimeout(timerRef.current);
              draftRef.current = e.target.value;
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendNow();
              }
            }}
            rows={1}
            maxLength={600}
            disabled={busy}
            placeholder={userTurns === 0 ? "Say or type your answer…" : "Say or type your reply…"}
            aria-label="Your message"
            className="flex-1 resize-none max-h-32 min-h-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={sendNow}
            disabled={busy || !`${draft} ${interim}`.trim()}
            aria-label="Send"
            className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
          >
            {phase === "thinking" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 select-none cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={prefs.autoSend}
            onChange={(e) => setPrefs((p) => ({ ...p, autoSend: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Send automatically when I pause
        </label>
      </footer>
    </div>
  );
};

// ============================================================
// Recap
// ============================================================

const Recap: React.FC<{
  summary: TutorSummary;
  scenarioTitle: string;
  onAgain: () => void;
}> = ({ summary, scenarioTitle, onAgain }) => {
  const wordBank = useWordBank(true);
  const stats = [
    { label: "Things you said", value: String(summary.turns) },
    { label: "Words spoken", value: String(summary.words) },
    { label: "Fluency", value: summary.fluency === null ? "—" : `${summary.fluency}/100` },
    { label: "XP earned", value: `+${summary.xpEarned}` },
  ];
  const empty = summary.turns === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{scenarioTitle}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {empty ? "That was a short one" : "Nice work!"}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">
          {empty
            ? "You didn't say anything this time. Start another conversation whenever you're ready."
            : summary.mistakes === 0
              ? "No mistakes to fix this time. Keep it up!"
              : `Here's what to remember from ${summary.mistakes} thing${summary.mistakes === 1 ? "" : "s"} to fix.`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {summary.fluency === null && !empty && (
        <p className="text-xs text-slate-500 -mt-2">Fluency appears once you've said about 25 words.</p>
      )}

      {summary.corrections.length > 0 && (
        <section className={`${card} p-5 sm:p-6`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Fix these next time</h2>
          <ul className="mt-3 space-y-3">
            {summary.corrections.map((c) => (
              <li key={c.original} className="text-sm">
                <p>
                  <span className="line-through text-rose-500">{c.original}</span>
                  <ArrowRight className="inline w-3.5 h-3.5 mx-1.5 text-slate-400" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.corrected}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.newWords.length > 0 && (
        <section className={`${card} p-5 sm:p-6`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">New words</h2>
          <ul className="mt-3 space-y-2.5">
            {summary.newWords.map((w) => {
              const saved = wordBank.savedSet.has(w.word.toLowerCase());
              return (
                <li key={w.word} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{w.word}</span>
                    <span className="text-slate-500"> · {w.meaning}</span>
                    {w.example && <span className="block text-xs text-slate-400">“{w.example}”</span>}
                  </span>
                  <button
                    type="button"
                    disabled={saved}
                    onClick={() => void wordBank.save({ word: w.word, meaning: w.meaning, sentence: w.example })}
                    className="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAgain}
          className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Practise again
        </button>
        <Link to="/dashboard" className="h-11 px-5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center hover:bg-slate-50 dark:hover:bg-white/[0.05]">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};

// ============================================================
// Page
// ============================================================

export const AiPartnerPage: React.FC = () => {
  const { data: status, isLoading, isError, refetch } = useTutorStatus();
  const start = useStartTutorSession();
  const [session, setSession] = useState<TutorSession | null>(null);
  const [recap, setRecap] = useState<{ summary: TutorSummary; scenarioTitle: string } | null>(null);
  const [resuming, setResuming] = useState(false);

  const begin = useCallback(
    async (scenario: string, level: CefrCode) => {
      try {
        const created = await start.mutateAsync({ scenario, level });
        setRecap(null);
        setSession(created);
        // Said out loud right away: the click that started this counts as the browser's permission to play sound
        const prefs = loadPrefs();
        if (prefs.voice && canSpeak() && created.messages[0]) void speakAloud(created.messages[0].text, prefs.slow);
      } catch (error) {
        toast.error(tutorErrorMessage(error, "Couldn't start the conversation. Please try again."));
      }
    },
    [start],
  );

  const resume = useCallback(
    async (sessionId: string) => {
      setResuming(true);
      try {
        const existing = await fetchTutorSession(sessionId);
        if (existing.ended) void refetch();
        else setSession(existing);
      } catch (error) {
        toast.error(tutorErrorMessage(error, "Couldn't open that conversation."));
      } finally {
        setResuming(false);
      }
    },
    [refetch],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">We couldn't load the AI partner</p>
        <button type="button" onClick={() => refetch()} className="mt-5 px-4 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Try again
        </button>
      </div>
    );
  }

  if (recap) {
    return (
      <Recap
        summary={recap.summary}
        scenarioTitle={recap.scenarioTitle}
        onAgain={() => {
          setRecap(null);
          setSession(null);
          void refetch();
        }}
      />
    );
  }

  if (session) {
    return (
      <Conversation
        key={session.sessionId}
        initial={session}
        onEnded={(summary, scenarioTitle) => {
          setSession(null);
          setRecap({ summary, scenarioTitle });
        }}
      />
    );
  }

  return (
    <Setup
      status={status}
      starting={start.isPending}
      resuming={resuming}
      onStart={begin}
      onResume={() => status.activeSessionId && void resume(status.activeSessionId)}
    />
  );
};
