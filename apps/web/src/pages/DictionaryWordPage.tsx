// apps/web/src/pages/DictionaryWordPage.tsx
/**
 * One dictionary word in full: level and how common it is, US and UK pronunciation (heard with the browser's own
 * voices), the meaning in your language, every meaning by part of speech with examples, synonyms and opposites,
 * word forms, the word family and real example sentences.
 */

import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, BookA, Check, ChevronLeft, ChevronRight, ExternalLink, Languages, Loader2, Plus, Quote, Volume2 } from "lucide-react";
import { dictError, useDictionaryWord, useMarkKnown, useSaveDictWord, type DictSense } from "../hooks/useDictionary";
import { useLookupState } from "../hooks/useLookup";
import { canSpeak, speak } from "../lib/speech";
import { LEVEL_STYLE, card } from "../components/dictionary/dictStyles";
import { tr, msg } from "../i18n/core";

const FORM_LABEL: Record<string, string> = {
  third: msg("he / she / it"),
  past: msg("past"),
  pastParticiple: msg("past participle"),
  ing: msg("-ing form"),
  plural: msg("plural"),
  comparative: msg("comparative"),
  superlative: msg("superlative"),
};
const FORM_ORDER = ["third", "past", "pastParticiple", "ing", "plural", "comparative", "superlative"];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The sentence with the word (or a form of it) in bold */
const Highlight: React.FC<{ text: string; words: string[] }> = ({ text, words }) => {
  const forms = words.filter(Boolean).map((w) => escapeRegExp(w)).sort((a, b) => b.length - a.length);
  if (!forms.length) return <>{tr(text)}</>;
  const parts = text.split(new RegExp(`\\b(${forms.join("|")})\\b`, "i"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <b key={i} className="font-semibold text-slate-900 dark:text-white not-italic">
            {p}
          </b>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

const SayButton: React.FC<{ text: string; accent?: "en-US" | "en-GB"; label: string; className?: string }> = ({ text, accent, label, className }) =>
  canSpeak() ? (
    <button
      type="button"
      onClick={() => void speak(text, { rate: 0.85, accent })}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-500/10 transition-colors ${className ?? ""}`}
      aria-label={tr(label)}
      title={tr(label)}
    >
      <Volume2 className="w-4 h-4" />
    </button>
  ) : null;

const WordChip: React.FC<{ text: string; links: Record<string, string>; tone?: "syn" | "ant" }> = ({ text, links, tone = "syn" }) => {
  const id = links[text.toLowerCase()];
  const cls = `inline-flex items-center h-7 px-2.5 rounded-full text-xs font-medium border transition-colors ${
    tone === "ant"
      ? "border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300"
      : "border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200"
  }`;
  return id ? (
    <Link to={`/dictionary/${id}`} className={`${cls} hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-indigo-300`}>
      {tr(text)}
    </Link>
  ) : (
    <span className={cls}>{tr(text)}</span>
  );
};

/** The meaning in the learner's language (free lookup; they pick the language once) */
const Translation: React.FC<{ word: string }> = ({ word }) => {
  const lookup = useLookupState(word);
  const languages = lookup.languages.filter((l) => l.code !== "en");
  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Languages className="w-4 h-4 text-indigo-500" /> {" "}{tr("In your language")}</h2>
        {languages.length > 0 && (
          <select
            value={lookup.language}
            onChange={(e) => lookup.setLanguage(e.target.value)}
            className="h-8 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-600 dark:text-slate-300"
            aria-label={tr("Your language")}
          >
            {!lookup.language && <option value="">{tr("Choose…")}</option>}
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 text-sm">
        {lookup.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : lookup.data?.translation ? (
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{lookup.data.translation}</p>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">
            {lookup.data?.notice === "limit"
              ? tr("The free translator is busy today. Try again later.")
              : lookup.language
                ? tr("No translation found.")
                : tr("Choose your language to see this word in it.")}
          </p>
        )}
      </div>
    </section>
  );
};

export const DictionaryWordPage: React.FC = () => {
  const { wordId } = useParams<{ wordId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDictionaryWord(wordId);
  const save = useSaveDictWord();
  const markKnown = useMarkKnown();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-page py-16 px-4 text-center">
        <p className="text-sm text-slate-500">{tr("We couldn't find that word.")}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" onClick={() => refetch()} className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr("Try again")}</button>
          <Link to="/dictionary" className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center">{tr("Back to the dictionary")}</Link>
        </div>
      </div>
    );
  }

  const { word, links } = data;
  const level = LEVEL_STYLE[word.lv];
  const forms = word.f ? FORM_ORDER.filter((k) => word.f![k]).map((k) => [k, word.f![k]] as const) : [];
  const allForms = [word.w, ...(word.alt ?? []), ...Object.values(word.f ?? {}).flatMap((v) => v.split(" / "))];
  const byPos = word.s.reduce<Array<{ pos: string; senses: DictSense[] }>>((groups, s) => {
    const g = groups.find((x) => x.pos === s.p);
    if (g) g.senses.push(s);
    else groups.push({ pos: s.p, senses: [s] });
    return groups;
  }, []);

  const doSave = () =>
    save.mutate(word.id, {
      onSuccess: () => toast.success(tr("“{w}” is in My words. It will come up in review.", { w: word.w })),
      onError: (e) => toast.error(dictError(e, "Couldn't save it")),
    });
  const toggleKnown = () =>
    markKnown.mutate(
      { id: word.id, known: data.status !== "known" },
      { onError: (e) => toast.error(dictError(e, "Couldn't update it")) },
    );

  return (
    <div className="min-h-screen bg-page py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Navigation (on phones, clear of the floating notification bell) */}
        <div className="flex items-center gap-2 max-lg:pr-14">
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dictionary"))} className="h-9 px-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.05] flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> {" "}{tr("Back")}</button>
          <Link to="/dictionary" className="h-9 px-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.05] flex items-center gap-1.5">
            <BookA className="w-4 h-4" /> {" "}{tr("Dictionary")}</Link>
          <span className="flex-1" />
          {data.prev && (
            <Link to={`/dictionary/${data.prev.id}`} className="h-9 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:bg-white dark:hover:bg-white/[0.05] flex items-center gap-1" title={tr("More common word")}>
              <ChevronLeft className="w-4 h-4" /> {data.prev.word}
            </Link>
          )}
          {data.next && (
            <Link to={`/dictionary/${data.next.id}`} className="h-9 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:bg-white dark:hover:bg-white/[0.05] flex items-center gap-1" title={tr("Less common word")}>
              {data.next.word} <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* The word */}
        <motion.section key={word.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${card} relative overflow-hidden p-6 sm:p-8`}>
          <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-indigo-300/20 dark:bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${level.chip}`}>{word.lv}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {level.name}
                  {word.est ? tr(" (estimated from how common it is)") : ""}
                </span>
              </div>
              <h1 className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white break-words">{word.w}</h1>
              {word.alt && word.alt.length > 0 && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tr("Also written:")}{" "}{word.alt.join(", ")}</p>}
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{word.pos.join(" · ")}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["us", "uk"] as const).map((accent) => {
                  const ipa = word.ipa?.[accent];
                  if (!ipa && !canSpeak()) return null;
                  return (
                    <div key={accent} className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] pl-3 pr-1 h-10">
                      <span className="text-[11px] font-bold uppercase text-slate-400">{accent === "us" ? "US" : "UK"}</span>
                      {ipa && <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{ipa}</span>}
                      <SayButton text={word.w} accent={accent === "us" ? "en-US" : "en-GB"} label={tr("Hear it ({value})", { value: accent === "us" ? "American" : "British" })} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {data.status === "new" ? (
                <button type="button" onClick={doSave} disabled={save.isPending} className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/15 disabled:opacity-60">
                  {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {" "}{tr("Save to My words")}</button>
              ) : (
                <Link to="/words" className="h-11 px-5 rounded-xl border border-sky-300/70 dark:border-sky-400/30 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-200 text-sm font-semibold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> {data.status === "known" ? tr("You know this word") : tr("In My words")}
                </Link>
              )}
              <button
                type="button"
                onClick={toggleKnown}
                disabled={markKnown.isPending}
                aria-pressed={data.status === "known"}
                className={`h-10 px-5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
                  data.status === "known"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                }`}
              >
                <Check className="w-4 h-4" /> {data.status === "known" ? tr("Marked as known") : tr("I already know it")}
              </button>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-semibold">
              #{word.r.toLocaleString()} · {data.commonness}
            </span>
            {word.t?.map((t) => (
              <Link key={t} to={`/dictionary?topic=${encodeURIComponent(t)}`} className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold hover:underline">
                {t}
              </Link>
            ))}
          </div>
        </motion.section>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Meanings */}
          <div className="space-y-4 min-w-0">
            {byPos.map((group) => (
              <section key={group.pos} className={`${card} p-5 sm:p-6`}>
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">{group.pos}</h2>
                <ol className="mt-3 space-y-5">
                  {group.senses.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 dark:bg-white/[0.06] text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center">{i + 1}</span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{s.d}</p>
                        {s.x?.map((x) => (
                          <p key={x} className="text-sm italic text-slate-500 dark:text-slate-400 pl-3 border-l-2 border-indigo-200 dark:border-indigo-500/30">
                            <Highlight text={x} words={allForms} />
                          </p>
                        ))}
                        {(s.syn?.length || s.ant?.length) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {s.syn?.length ? <span className="text-[11px] font-semibold text-slate-400 mr-0.5">{tr("Similar")}</span> : null}
                            {s.syn?.map((x) => <WordChip key={x} text={x} links={links} />)}
                            {s.ant?.length ? <span className="text-[11px] font-semibold text-slate-400 ml-1 mr-0.5">{tr("Opposite")}</span> : null}
                            {s.ant?.map((x) => <WordChip key={x} text={x} links={links} tone="ant" />)}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

            {word.ex && word.ex.length > 0 && (
              <section className={`${card} p-5 sm:p-6`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Quote className="w-4 h-4 text-indigo-500" /> {" "}{tr("Real sentences")}</h2>
                <ul className="mt-3 space-y-2">
                  {word.ex.map(([text, id]) => (
                    <li key={id} className="flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5">
                      <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
                        <Highlight text={text} words={allForms} />
                      </p>
                      <SayButton text={text} label={tr("Hear the sentence")} className="shrink-0 -my-1" />
                      <a href={`https://tatoeba.org/en/sentences/show/${id}`} target="_blank" rel="noreferrer" className="shrink-0 w-8 h-8 -my-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/5" aria-label={tr("See this sentence on Tatoeba")} title={tr("Sentence from Tatoeba")}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">{tr("Sentences from Tatoeba (CC BY 2.0 FR).")}</p>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <Translation word={word.w} />

            {forms.length > 0 && (
              <section className={`${card} p-5`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Word forms")}</h2>
                <dl className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {forms.map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 py-2">
                      <dt className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400">{tr(FORM_LABEL[k]) ?? k}</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {word.fam && word.fam.length > 0 && (
              <section className={`${card} p-5`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Word family")}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Words made from the same root")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {word.fam.map((x) => (
                    <WordChip key={x} text={x} links={links} />
                  ))}
                </div>
              </section>
            )}

            <section className={`${card} p-5 text-xs text-slate-500 dark:text-slate-400 space-y-1`}>
              <p>
                <b className="text-slate-700 dark:text-slate-200">{tr("Level:")}</b> {word.est ? tr("estimated from how common the word is") : tr("CEFR-J / Octanove word lists")}.
              </p>
              <p>
                <b className="text-slate-700 dark:text-slate-200">{tr("Meanings:")}</b> {" "}{tr("Open English WordNet{value}.", { value: word.pos.some((p) => !["noun", "verb", "adjective", "adverb"].includes(p)) ? tr(" and Wiktionary") : "" })}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DictionaryWordPage;
