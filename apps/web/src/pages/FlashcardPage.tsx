import { useState } from "react";
import { useFlashcards, useReviewFlashcard } from "../hooks/useLearning";
import { toast } from "sonner";
import {
  Layers,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader2,
} from "lucide-react";

export const FlashcardPage = () => {
  const [language, setLanguage] = useState("");
  const [dueOnly, setDueOnly] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [, setIsFlipping] = useState(false);

  const { data, isLoading, refetch } = useFlashcards({
    language,
    dueOnly,
  });
  const reviewMutation = useReviewFlashcard();

  const currentCard = data && data.length > 0 ? data[currentIndex] : null;

  const toggleFlip = () => {
    setIsFlipping(true);
    setShowBack((prev) => !prev);
    setTimeout(() => setIsFlipping(false), 300);
  };

  const handleReview = async (difficulty: "easy" | "medium" | "hard") => {
    if (!currentCard) return;
    const id = currentCard.flashcardId || currentCard.vocabularyId;
    if (!id) return;

    try {
      await reviewMutation.mutateAsync({ flashcardId: id, difficulty });
      toast.success(`Card marked as ${difficulty}`);
      setShowBack(false);

      if (data && currentIndex < data.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex(0);
        refetch();
      }
    } catch {
      toast.error("Failed to submit review");
    }
  };

  const reset = () => {
    setCurrentIndex(0);
    setShowBack(false);
    refetch();
  };

  const handleNext = () => {
    if (!data) return;
    setShowBack(false);
    setCurrentIndex((prev) => (prev < data.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    if (!data) return;
    setShowBack(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : data.length - 1));
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">
          Preparing your flashcard deck...
        </p>
      </div>
    );
  }

  const card = currentCard;
  const front =
    card?.flashcard?.front || card?.vocabulary?.word || "No front text";
  const back =
    card?.flashcard?.back || card?.vocabulary?.translation || "No back text";

  const progressPercent = data
    ? Math.round(((currentIndex + 1) / data.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Spaced Repetition
              </h1>
              <p className="text-sm text-slate-500">
                Review memory cards for long-term retention
              </p>
            </div>
          </div>

          {/* Quick Filter */}
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setCurrentIndex(0);
                setShowBack(false);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>

            <button
              onClick={() => {
                setDueOnly(!dueOnly);
                setCurrentIndex(0);
                setShowBack(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                dueOnly
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {dueOnly ? "Due Only" : "All Cards"}
            </button>
          </div>
        </div>

        {/* Empty State */}
        {!data || data.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-800">
                All Caught Up!
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No flashcards are currently due for review. Great work maintaining your daily streak!
              </p>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Refresh Deck</span>
            </button>
          </div>
        ) : (
          /* Active Card Deck */
          <div className="space-y-6">
            {/* Progress Bar & Counter */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>
                  Card {currentIndex + 1} of {data.length}
                </span>
                <span>{progressPercent}% Complete</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Flashcard Container with Flip Animation */}
            <div
              onClick={toggleFlip}
              className={`relative min-h-[260px] bg-white rounded-3xl border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer p-8 flex flex-col items-center justify-center text-center select-none group ${
                showBack ? "border-indigo-200 bg-indigo-50/10" : ""
              }`}
            >
              <span className="absolute top-4 left-4 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold uppercase tracking-wider">
                {showBack ? "Back (Answer)" : "Front (Question)"}
              </span>

              {/* Word / Front or Back */}
              <div className="space-y-2 my-auto">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-relaxed">
                  {showBack ? back : front}
                </h2>
              </div>

              {/* Card Hint Footer */}
              <div className="absolute bottom-4 flex items-center gap-1.5 text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Click card to flip</span>
              </div>
            </div>

            {/* Difficulty Review Buttons (Visible on Back) */}
            {showBack ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  How easy was this recall?
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleReview("hard")}
                    disabled={reviewMutation.isPending}
                    className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 font-bold rounded-2xl text-xs transition-all flex flex-col items-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <span>Hard</span>
                    <span className="text-[10px] font-normal text-rose-500">
                      Repeat Soon
                    </span>
                  </button>

                  <button
                    onClick={() => handleReview("medium")}
                    disabled={reviewMutation.isPending}
                    className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-700 font-bold rounded-2xl text-xs transition-all flex flex-col items-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <span>Medium</span>
                    <span className="text-[10px] font-normal text-amber-500">
                      Normal Review
                    </span>
                  </button>

                  <button
                    onClick={() => handleReview("easy")}
                    disabled={reviewMutation.isPending}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 font-bold rounded-2xl text-xs transition-all flex flex-col items-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <span>Easy</span>
                    <span className="text-[10px] font-normal text-emerald-500">
                      Mastered
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Navigation & Reset Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePrev}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-xs transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Progress</span>
              </button>

              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-xs transition-all"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};