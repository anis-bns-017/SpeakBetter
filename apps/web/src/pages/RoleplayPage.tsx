// apps/web/src/pages/RoleplayPage.tsx
/**
 * One role-play conversation. The other person's lines are read aloud; at each of your turns you pick a
 * reply and say it, and the pronunciation checker scores it. Without a microphone you can still read your
 * part aloud and tap "I said it".
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Lightbulb, Loader2, Mic, RotateCcw, Square, Users, Volume2, Zap } from "lucide-react";
import { useFinishScenario, useScenario, type RoleplayResult } from "../hooks/useRoleplay";
import { canListen, useListenOnce, useSubmitAttempt, type AttemptResult } from "../hooks/usePronunciation";
import { scenarioIcon } from "../components/roleplay/scenarioIcons";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-50";

const scoreTone = (score: number) =>
  score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

/** One line of the conversation, as a chat bubble */
const Bubble: React.FC<{ who: "partner" | "you"; name: string; text: string; score?: number | null }> = ({ who, name, text, score }) => (
  <div className={`flex ${who === "you" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[85%] rounded-3xl px-4 py-3 ${who === "you" ? "bg-indigo-600 text-white rounded-br-lg" : "bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 rounded-bl-lg"}`}>
      <p className={`text-[11px] font-semibold mb-0.5 ${who === "you" ? "text-white/70" : "text-slate-500"}`}>
        {name}
        {typeof score === "number" && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 tabular-nums">{score}</span>}
      </p>
      <div className="flex items-start gap-2">
        <p className="text-sm leading-relaxed">{text}</p>
        {who === "partner" && canSpeak() && (
          <button type="button" onClick={() => void speak(text, { rate: 0.92 })} aria-label="Hear it again" className="text-slate-400 hover:text-indigo-600 shrink-0 mt-0.5">
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  </div>
);

type Phase = "intro" | "talking" | "done";

export const RoleplayPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { data: scenario, isLoading, isError } = useScenario(scenarioId);
  const finish = useFinishScenario(scenarioId ?? "");
  const submit = useSubmitAttempt();
  const { listening, listen, stop: stopListening, error: listenError } = useListenOnce();

  const [phase, setPhase] = useState<Phase>("intro");
  const [turn, setTurn] = useState(0);
  const [choice, setChoice] = useState<0 | 1 | null>(null);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  /** What you said at each turn, and your score (null = read aloud without the mic) */
  const [said, setSaid] = useState<Array<{ text: string; score: number | null }>>([]);
  const [result, setResult] = useState<RoleplayResult | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (listenError) toast.error(listenError);
  }, [listenError]);
  useEffect(() => {
    setPhase("intro");
    setTurn(0);
    setChoice(null);
    setAttempt(null);
    setSaid([]);
    setResult(null);
  }, [scenarioId]);

  // The other person speaks when it is their turn
  useEffect(() => {
    if (phase === "talking" && scenario) {
      void speak(scenario.exchanges[turn].partner, { rate: 0.92 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, scenario?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turn, choice, attempt, phase]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !scenario) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>
        Couldn't load this conversation. <Link to="/roleplay" className="text-indigo-600 underline">Back to role-play</Link>
      </div>
    );
  }

  const Icon = scenarioIcon(scenario.icon);
  const exchange = scenario.exchanges[turn];
  const reply = choice !== null ? exchange.replies[choice] : null;
  const micOk = canListen();

  const sayIt = async () => {
    if (!reply) return;
    if (listening) {
      stopListening();
      return;
    }
    stopSpeaking();
    const started = performance.now();
    const heard = await listen();
    if (!heard) return;
    try {
      setAttempt(
        await submit.mutateAsync({
          target: reply,
          heard: heard.alternatives,
          confidence: heard.confidence ?? undefined,
          source: "sentence",
          durationMs: heard.durationMs ?? Math.round(performance.now() - started),
        }),
      );
    } catch {
      toast.error("Couldn't score that. Try again.");
    }
  };

  const goOn = async (score: number | null) => {
    if (!reply) return;
    const nextSaid = [...said, { text: reply, score }];
    setSaid(nextSaid);
    setChoice(null);
    setAttempt(null);
    if (turn < scenario.exchanges.length - 1) {
      setTurn(turn + 1);
      return;
    }
    setPhase("done");
    void speak(scenario.closing, { rate: 0.92 });
    try {
      const r = await finish.mutateAsync(nextSaid.map((s) => s.score));
      setResult(r);
      if (r.xp > 0) toast.success(`Conversation done! +${r.xp} XP`);
    } catch {
      toast.error("Couldn't save your result.");
    }
  };

  const restart = () => {
    stopSpeaking();
    setTurn(0);
    setChoice(null);
    setAttempt(null);
    setSaid([]);
    setResult(null);
    setPhase("talking");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <Link to="/roleplay" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Role-play
      </Link>

      <header className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-orange-500/10 text-orange-600 dark:text-orange-300">
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{scenario.level} · you are the {scenario.you.toLowerCase()}</p>
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{scenario.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{scenario.setting}</p>
        </div>
      </header>

      {phase === "intro" && (
        <>
          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Useful phrases
            </h2>
            <ul className="mt-3 space-y-2">
              {scenario.phrases.map((p) => (
                <li key={p.phrase} className="text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white">{p.phrase}</span>
                  <span className="text-slate-500"> · {p.use}</span>
                </li>
              ))}
            </ul>
          </section>
          <div className={`${card} p-5 text-sm text-slate-600 dark:text-slate-300`}>
            {scenario.partner} will speak first. At each of your turns, pick a reply and say it out loud.
            {!micOk && " This browser can't listen, so read your replies aloud and tap “I said it”."}
          </div>
          <div className="flex justify-end">
            <button type="button" className={primaryBtn} onClick={() => setPhase("talking")}>
              Start the conversation <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {phase !== "intro" && (
        <section className="space-y-3" aria-label="Conversation" aria-live="polite">
          {said.map((s, i) => (
            <React.Fragment key={i}>
              <Bubble who="partner" name={scenario.partner} text={scenario.exchanges[i].partner} />
              <Bubble who="you" name="You" text={s.text} score={s.score} />
            </React.Fragment>
          ))}
          {phase === "talking" && <Bubble who="partner" name={scenario.partner} text={exchange.partner} />}
          {phase === "done" && <Bubble who="partner" name={scenario.partner} text={scenario.closing} />}
        </section>
      )}

      {phase === "talking" && (
        <section className={`${card} p-5 space-y-4`}>
          {choice === null ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Your turn: pick a reply</p>
              <div className="space-y-2">
                {exchange.replies.map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setChoice(i as 0 | 1)}
                    className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Now say it out loud</p>
              {attempt ? (
                <div role="status">
                  <p className={`text-2xl font-bold tabular-nums ${scoreTone(attempt.score)}`}>{attempt.score}</p>
                  <p className="text-base leading-8">
                    {attempt.words.map((w, i) => (
                      <span key={i}>
                        {i > 0 && " "}
                        <span
                          className={
                            w.status === "good"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : w.status === "close"
                                ? "text-amber-600 underline decoration-dotted underline-offset-4"
                                : "text-rose-600 underline decoration-wavy underline-offset-4"
                          }
                        >
                          {w.text}
                        </span>
                      </span>
                    ))}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">{reply}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {micOk && (
                  <button
                    type="button"
                    onClick={() => void sayIt()}
                    disabled={submit.isPending}
                    className={`inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold text-white ${listening ? "bg-rose-600 animate-pulse" : "bg-orange-600 hover:bg-orange-700"}`}
                  >
                    {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {listening ? "Stop" : attempt ? "Try again" : "Say it"}
                  </button>
                )}
                {canSpeak() && (
                  <button type="button" className={ghostBtn} onClick={() => reply && void speak(reply, { rate: 0.9 })} disabled={listening}>
                    <Volume2 className="w-4 h-4" /> Hear it
                  </button>
                )}
                <button type="button" className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline ml-1" onClick={() => setChoice(null)}>
                  Pick the other reply
                </button>
              </div>
              <div className="flex justify-end">
                {attempt ? (
                  <button type="button" className={primaryBtn} onClick={() => void goOn(attempt.score)}>
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button type="button" className={ghostBtn} onClick={() => void goOn(null)}>
                    <Check className="w-4 h-4" /> I said it
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {phase === "done" && (
        <>
          <section className={`${card} p-6 text-center space-y-2`}>
            <p className="text-sm font-semibold text-slate-500">Conversation finished</p>
            {result?.average !== null && result?.average !== undefined ? (
              <p className={`text-3xl font-bold tabular-nums ${scoreTone(result.average)}`}>{result.average}</p>
            ) : (
              <p className="text-lg font-bold text-slate-900 dark:text-white">Well done!</p>
            )}
            <p className="text-xs text-slate-500">
              {result ? `${result.spoken} of ${result.turns} replies scored${result.best !== null ? ` · best ever ${result.best}` : ""}` : finish.isPending ? "Saving…" : ""}
            </p>
            {result && result.xp > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="w-3.5 h-3.5" /> +{result.xp} XP
              </span>
            )}
          </section>

          <section className={`${card} p-5 flex flex-col sm:flex-row sm:items-center gap-3`}>
            <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-300 flex-1">Ready for the real thing? Try this conversation with a person in a voice room or a random call.</p>
            <div className="flex gap-2">
              <Link to="/voice" className={ghostBtn}>Voice rooms</Link>
              <Link to="/call" className={ghostBtn}>Random call</Link>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={ghostBtn} onClick={restart}>
              <RotateCcw className="w-4 h-4" /> Again, other replies
            </button>
            {scenario.next && (
              <Link to={`/roleplay/${scenario.next.id}`} className={primaryBtn}>
                Next: {scenario.next.title} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default RoleplayPage;
