import { useState } from "react";
import { useExercises, useSubmitExercise } from "../hooks/useLearning";
import { toast } from "sonner";
import {
  Dumbbell,
  Filter,
  Loader2,
  BookOpen,
  Send,
  Globe,
  Sparkles,
  AlertCircle,
  Layers,
} from "lucide-react";

export const ExercisesPage = () => {
  const [language, setLanguage] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const { data, isLoading, isError, refetch } = useExercises({
    language,
    type,
    difficulty,
  });
  const submitMutation = useSubmitExercise();

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleSubmit = async (exerciseId: string) => {
    try {
      setSubmittingId(exerciseId);
      const answerArray = Object.values(answers);
      const result = await submitMutation.mutateAsync({
        exerciseId,
        answers: answerArray,
        metadata: { submittedAt: new Date().toISOString() },
      });
      toast.success(`Exercise submitted! Score: ${result.score}%`);
      setSelectedExercise(null);
      setAnswers({});
      refetch();
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  const getDifficultyBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "intermediate":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "advanced":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Interactive Exercises
            </h1>
            <p className="text-sm text-slate-500">
              Practice reading, grammar, and vocabulary skills to level up your language mastery.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filter Exercises</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Language Select */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="">All Languages</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
              <Globe className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Type Select */}
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="">All Types</option>
                <option value="GRAMMAR">Grammar</option>
                <option value="VOCABULARY">Vocabulary</option>
                <option value="READING">Reading</option>
                <option value="LISTENING">Listening</option>
                <option value="WRITING">Writing</option>
                <option value="SPEAKING">Speaking</option>
              </select>
              <BookOpen className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Difficulty Select */}
            <div className="relative">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <Sparkles className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          /* Loading Skeletons */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 w-48 bg-slate-200 rounded" />
                  <div className="h-5 w-20 bg-slate-100 rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-8 w-32 bg-slate-200 rounded-xl mt-2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              Failed to load exercises
            </h3>
            <p className="text-sm text-slate-500">
              We couldn't retrieve the exercises. Please check your network connection and try again.
            </p>
          </div>
        ) : !data || data.length === 0 ? (
          /* Empty State */
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No exercises found
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Try adjusting your filter settings above to explore different languages or skill levels.
            </p>
          </div>
        ) : (
          /* Exercise Cards */
          <div className="space-y-4">
            {data.map((ex) => {
              const isSelected = selectedExercise === ex.id;
              const isSubmitting = submittingId === ex.id;

              return (
                <div
                  key={ex.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/10 p-6"
                      : "border-slate-100 hover:border-slate-200 p-6"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        {ex.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {ex.description}
                      </p>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold uppercase tracking-wider">
                        {ex.language || "EN"}
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-semibold">
                        {ex.type}
                      </span>
                      <span
                        className={`px-2.5 py-1 border rounded-full text-xs font-semibold capitalize ${getDifficultyBadge(
                          ex.difficulty
                        )}`}
                      >
                        {ex.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Active Exercise Input Section */}
                  {isSelected ? (
                    <div className="mt-6 pt-5 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                      {/* Exercise Content Box */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-slate-800 text-sm leading-relaxed font-mono">
                        <p className="whitespace-pre-wrap">{ex.content}</p>
                      </div>

                      {/* Answer Field */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                          Your Answer
                        </label>
                        <input
                          type="text"
                          placeholder="Type your answer here..."
                          value={answers[ex.id] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [ex.id]: e.target.value })
                          }
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Control Action Buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => handleSubmit(ex.id)}
                          disabled={
                            isSubmitting || !answers[ex.id]?.trim()
                          }
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Exercise</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedExercise(null)}
                          disabled={isSubmitting}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Start Button when not active */
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
                      <button
                        onClick={() => setSelectedExercise(ex.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-semibold rounded-xl text-xs transition-all"
                      >
                        <span>Start Exercise</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};