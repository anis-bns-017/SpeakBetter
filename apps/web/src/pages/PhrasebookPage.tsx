// Phrasebook: useful phrases by situation. Hear each one, see what it means in Bangla, and save it to review.
import React, { useMemo, useState } from "react";
import { BookmarkPlus, Check, MessageSquareQuote, Search, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, EmptyState, PageHeader } from "../components/ui";
import { apiClient } from "../lib/api/client";
import { serverMessage } from "../lib/serverMessage";
import { canSpeak, speak } from "../lib/speech";
import { SITUATIONS, searchPhrases } from "../lib/phrasebook";
import { useT } from "../i18n";
import { tr } from "../i18n/core";

export const PhrasebookPage: React.FC = () => {
  const { lang } = useT();
  const [situation, setSituation] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [showBn, setShowBn] = useState(lang === "bn");
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const results = useMemo(() => searchPhrases(query, situation === "all" ? undefined : situation), [query, situation]);
  const titleOf = (id: string) => SITUATIONS.find((s) => s.id === id)?.title ?? "";

  const save = async (id: string, en: string, note: string, bn: string) => {
    setSaving(id);
    try {
      // The meaning is what shows on the back of the review card: when to use it, plus the Bangla meaning
      await apiClient.post("/words", { word: en, meaning: `${note} (${bn})` });
      setSaved((s) => new Set(s).add(id));
      toast.success(tr("Saved to My words."), { id: `phrase-${id}` });
    } catch (e) {
      const message = serverMessage(e);
      // "already in your words" is good news, not a failure
      if ((e as { response?: { status?: number } })?.response?.status === 409) setSaved((s) => new Set(s).add(id));
      toast[(e as { response?: { status?: number } })?.response?.status === 409 ? "info" : "error"](message || tr("Couldn't save the phrase."), { id: `phrase-${id}` });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        icon={MessageSquareQuote}
        title={tr("Phrasebook")}
        subtitle={tr("Phrases you can use today, sorted by situation. Hear them, see what they mean, and save the ones you want to remember.")}
      />

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search phrases")}
          aria-label={tr("Search phrases")}
          className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-slate-900 dark:text-white"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr("Situations")}>
        <Chip selected={situation === "all"} onClick={() => setSituation("all")}>
          {tr("All")}
        </Chip>
        {SITUATIONS.map((s) => (
          <Chip key={s.id} selected={situation === s.id} onClick={() => setSituation(s.id)}>
            {tr(s.title)}
          </Chip>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
        <input type="checkbox" checked={showBn} onChange={(e) => setShowBn(e.target.checked)} className="h-4 w-4 rounded border-line" />
        {tr("Show the Bangla meaning")}
      </label>

      {results.length === 0 ? (
        <EmptyState icon={Search} title={tr("No phrases found")} text={tr("Try another word, or pick a different situation.")} />
      ) : (
        <ul className="space-y-3">
          {results.map((ph) => (
            <li key={ph.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">{ph.en}</p>
                  <div className="flex shrink-0 gap-1.5">
                    {canSpeak() && (
                      <Button variant="secondary" size="sm" icon={Volume2} aria-label={tr("Hear it")} onClick={() => void speak(ph.en, { rate: 0.9 })} />
                    )}
                    <Button
                      variant="soft"
                      size="sm"
                      icon={saved.has(ph.id) ? Check : BookmarkPlus}
                      loading={saving === ph.id}
                      disabled={saved.has(ph.id)}
                      aria-label={saved.has(ph.id) ? tr("Saved") : tr("Save to My words")}
                      onClick={() => void save(ph.id, ph.en, ph.note, ph.bn)}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{ph.note}</p>
                {showBn && <p lang="bn" className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{ph.bn}</p>}
                {situation === "all" && <p className="text-xs text-slate-600 dark:text-slate-400">{tr(titleOf(ph.situation))}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PhrasebookPage;
