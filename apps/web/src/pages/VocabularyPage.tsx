import { useState } from 'react';
import { useVocabulary, useReviewVocabulary } from '../hooks/useLearning';
import { toast } from 'sonner';
import {
  BookMarked,
  Search,
  RotateCw,
  Globe2,
  BarChart,
  Smile,
  Meh,
  Frown,
  Quote,
  Inbox,
} from 'lucide-react';

export const VocabularyPage = () => {
  const [language, setLanguage] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isFetching, refetch } = useVocabulary({
    language,
    difficulty,
    search,
  });
  const reviewMutation = useReviewVocabulary();

  const handleReview = async (id: string, difficulty: 'easy' | 'medium' | 'hard') => {
    try {
      await reviewMutation.mutateAsync({ vocabularyId: id, difficulty });
      toast.success(`Reviewed as ${difficulty}!`);
      refetch();
    } catch {
      toast.error('Review failed');
    }
  };

  if (isLoading) {
    return <VocabularySkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Vocabulary Vault
              </h1>
              <p className="text-xs text-slate-500">
                Review spaced repetition items and strengthen word recall.
              </p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 sm:px-4 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-2 active:scale-95 shrink-0"
            title="Refresh Vocabulary"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search words or translations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex gap-3">
            {/* Language Select */}
            <div className="relative flex-1 md:w-44">
              <Globe2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">All languages</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            {/* Level Select */}
            <div className="relative flex-1 md:w-44">
              <BarChart className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">All levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>

        {/* Word Items Container */}
        {data && data.items.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {data.items.map((item) => {
                const isItemReviewing =
                  reviewMutation.isPending &&
                  reviewMutation.variables?.vocabularyId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Word Details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">
                          {item.word}
                        </h3>
                        <span className="text-xs font-semibold text-slate-500">
                          — {item.translation}
                        </span>
                      </div>

                      {item.exampleSentence && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                          <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span className="italic">{item.exampleSentence}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 uppercase tracking-wider text-[10px]">
                          {item.language || 'EN'}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{item.difficulty}</span>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-50 flex items-center gap-2">
                      <button
                        onClick={() => handleReview(item.id, 'easy')}
                        disabled={isItemReviewing}
                        className="flex-1 md:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-emerald-200/60 disabled:opacity-50"
                      >
                        <Smile className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Easy</span>
                      </button>

                      <button
                        onClick={() => handleReview(item.id, 'medium')}
                        disabled={isItemReviewing}
                        className="flex-1 md:flex-none px-3.5 py-2 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-amber-200/60 disabled:opacity-50"
                      >
                        <Meh className="w-3.5 h-3.5 text-amber-600" />
                        <span>Medium</span>
                      </button>

                      <button
                        onClick={() => handleReview(item.id, 'hard')}
                        disabled={isItemReviewing}
                        className="flex-1 md:flex-none px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-rose-200/60 disabled:opacity-50"
                      >
                        <Frown className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hard</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="text-center text-xs font-semibold text-slate-400 py-2">
              Showing {data.items.length} of {data.total} vocabulary cards
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No Vocabulary Items Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try updating your search phrase or removing language/difficulty filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Skeleton Loader Component
const VocabularySkeleton = () => (
  <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-64 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-9 w-24 bg-slate-200 rounded-xl" />
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm h-14 animate-pulse bg-slate-100" />

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm animate-pulse flex flex-col md:flex-row justify-between gap-4"
          >
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-10 w-full bg-slate-50 rounded-xl" />
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="w-20 h-9 bg-slate-100 rounded-xl" />
              <div className="w-20 h-9 bg-slate-100 rounded-xl" />
              <div className="w-20 h-9 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);