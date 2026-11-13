import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import {
  browserLanguage,
  NO_TRANSLATION,
  useLookupQuery,
  type LookupMeaning,
  type LookupState,
} from '../../hooks/useLookup';
import { tr } from "../../i18n/core";

/** The sentence you selected a word from, translated whole */
const SentenceTranslation: React.FC<{ sentence: string; language: string; muted: string; body: string }> = ({
  sentence,
  language,
  muted,
  body,
}) => {
  const query = useLookupQuery(sentence, language || null);
  if (query.isFetching && !query.data) {
    return (
      <p className={`flex items-center gap-2 ${muted}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {" "}{tr("Translating…")}</p>
    );
  }
  if (query.isError || !query.data?.translation) {
    return <p className={muted}>{query.data?.notice === 'limit' ? tr("The free translation limit is reached for now.") : tr("Could not translate that sentence.")}</p>;
  }
  return (
    <p className={body} lang={query.data.target?.code}>
      {query.data.translation}
    </p>
  );
};

/** Definitions in the order the dictionary gives them, grouped by part of speech */
function groupMeanings(meanings: LookupMeaning[]) {
  const groups: Array<{ partOfSpeech: string; items: LookupMeaning[] }> = [];
  for (const m of meanings) {
    const last = groups[groups.length - 1];
    if (last && last.partOfSpeech === m.partOfSpeech) last.items.push(m);
    else groups.push({ partOfSpeech: m.partOfSpeech, items: [m] });
  }
  return groups;
}

/**
 * What a looked-up word means: the translation, every definition grouped by part of speech with examples,
 * synonyms and antonyms, and (when given the sentence it came from) a translation of that sentence.
 * Shared by the chat popup, the AI partner and the live captions. `tone="dark"` is for always-dark panels.
 */
export const LookupBody: React.FC<{ lookup: LookupState; tone?: 'auto' | 'dark'; sentence?: string }> = ({
  lookup,
  tone = 'auto',
  sentence,
}) => {
  const { data, isLoading, isError, language, setLanguage, languages } = lookup;
  const [showSentence, setShowSentence] = useState(false);
  const dark = tone === 'dark';
  const strong = dark ? 'text-white' : 'text-slate-900 dark:text-white';
  const body = dark ? 'text-slate-200' : 'text-slate-700 dark:text-slate-200';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const rule = dark ? 'border-white/10' : 'border-slate-200 dark:border-white/10';
  const chip = dark ? 'bg-white/10 text-slate-200' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200';
  const field = dark
    ? 'bg-white/5 border-white/10 text-slate-200'
    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200';

  const groups = groupMeanings(data?.meanings ?? []);
  const nothing = data && !data.translation && groups.length === 0;
  const suggestion = !language ? browserLanguage(languages) : null;
  // A sentence is only worth translating when there is more to it than the selection, and it fits
  const canTranslateSentence =
    !!sentence && !!data && sentence.trim().toLowerCase() !== data.text.toLowerCase() && sentence.length <= 300;

  return (
    <div className="text-[13px] leading-relaxed">
      <div className="flex items-center gap-1.5">
        <Languages className={`h-3.5 w-3.5 shrink-0 ${muted}`} aria-hidden />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label={tr("Show the meaning in")}
          className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-[11px] outline-none ${field}`}
        >
          {!language && <option value="">{tr("Choose your language…")}</option>}
          <option value={NO_TRANSLATION}>{tr("English only (no translation)")}</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2.5">
        {isLoading && (
          <p className={`flex items-center gap-2 ${muted}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {" "}{tr("Looking it up…")}</p>
        )}
        {isError && <p className={muted}>{tr("Could not look that up. Check your connection and try again.")}</p>}

        {data?.translation && (
          <p className={`text-[15px] font-semibold ${strong}`} lang={data.target?.code}>
            {data.translation}
          </p>
        )}
        {data?.notice === 'no-language' && !data.translation && (
          <p className={muted}>
            {tr("Choose your language above to see the translation.")}{suggestion && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setLanguage(suggestion.code)}
                  className="font-semibold text-indigo-500 hover:underline"
                >
                  {tr("Show in")}{" "}{suggestion.name}
                </button>
              </>
            )}
          </p>
        )}
        {data?.notice === 'limit' && (
          <p className={muted}>{tr("The free translation limit is reached for now. The English meaning still works.")}</p>
        )}
        {data?.notice === 'unavailable' && <p className={muted}>{tr("The translation service did not answer.")}</p>}

        {data?.baseForm && (
          <p className={`mt-1.5 text-xs ${muted}`}>
            {tr("A form of")}{" "}<span className={`font-semibold ${body}`}>{data.baseForm}</span>
          </p>
        )}

        {groups.length > 0 && (
          <div className={`${data?.translation ? 'mt-2' : ''} max-h-56 space-y-2 overflow-y-auto pr-1`}>
            {groups.map((g, gi) => (
              <div key={`${g.partOfSpeech}-${gi}`}>
                {g.partOfSpeech && <p className={`text-xs font-semibold italic ${muted}`}>{g.partOfSpeech}</p>}
                <ol className="space-y-1">
                  {g.items.map((m, i) => (
                    <li key={i} className={body}>
                      {m.definition}
                      {m.example && <span className={`block italic ${muted}`}>“{m.example}”</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {data && (data.synonyms.length > 0 || data.antonyms.length > 0) && (
          <div className="mt-2 space-y-1.5">
            {data.synonyms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className={`text-[11px] font-semibold ${muted}`}>{tr("Similar")}</span>
                {data.synonyms.map((w) => (
                  <span key={w} className={`rounded-full px-2 py-0.5 text-[11px] ${chip}`}>
                    {w}
                  </span>
                ))}
              </div>
            )}
            {data.antonyms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className={`text-[11px] font-semibold ${muted}`}>{tr("Opposite")}</span>
                {data.antonyms.map((w) => (
                  <span key={w} className={`rounded-full px-2 py-0.5 text-[11px] ${chip}`}>
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {nothing && !data.notice && (
          <p className={muted}>{data.kind === 'word' ? tr("No meaning found for that word.") : tr("No translation found.")}</p>
        )}
      </div>

      {canTranslateSentence && (
        <div className={`mt-3 border-t pt-2.5 ${rule}`}>
          <p className={`line-clamp-2 text-xs italic ${muted}`}>“{sentence}”</p>
          {showSentence ? (
            <div className="mt-1">
              <SentenceTranslation sentence={sentence} language={language} muted={muted} body={body} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSentence(true)}
              disabled={!language || language === NO_TRANSLATION}
              title={!language || language === NO_TRANSLATION ? tr("Choose your language first") : undefined}
              className="mt-1 text-xs font-semibold text-indigo-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
            >
              {tr("Translate the whole sentence")}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default LookupBody;
