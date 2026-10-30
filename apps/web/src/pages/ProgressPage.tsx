import { useState, useMemo } from "react";
import { useProgress } from "../hooks/useLearning";
import {
  TrendingUp,
  Zap,
  Flame,
  Award,
  CheckCircle2,
  Globe2,
  Search,
  AlertCircle,
  BarChart3,
} from "lucide-react";

export const ProgressPage = () => {
  const { data, isLoading } = useProgress();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!data?.progress) return [];
    if (!searchQuery.trim()) return data.progress;

    const query = searchQuery.toLowerCase();
    return data.progress.filter(
      (item) =>
        item.skill.toLowerCase().includes(query) ||
        item.language?.toLowerCase().includes(query) ||
        item.level?.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  if (isLoading) {
    return <ProgressSkeleton />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-3 max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No Progress Data Found
          </h3>
          <p className="text-xs text-slate-500">
            Start completing exercises to see your stats and skill mastery here.
          </p>
        </div>
      </div>
    );
  }

  const masteredCount =
    data.progress?.filter((item) => item.mastered).length || 0;

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Your Progress
              </h1>
              <p className="text-xs text-slate-500">
                Track your active skills, earned experience points, and daily consistency.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-xl text-xs font-bold self-start sm:self-auto">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>{masteredCount} Skills Mastered</span>
          </div>
        </div>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total XP Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-100">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">
                {data.totalXP || 0}
              </p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total XP
              </p>
            </div>
          </div>

          {/* Day Streak Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-100">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">
                {data.streak || 0} Days
              </p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Day Streak
              </p>
            </div>
          </div>

          {/* Active Skills Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-100">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">
                {data.progress?.length || 0}
              </p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Skills
              </p>
            </div>
          </div>
        </div>

        {/* Skill Breakdown Header & Search */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Skill Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Detailed view of exercise completion and level growth
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search skills or languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Skills List */}
          {filteredSkills.length > 0 ? (
            <div className="space-y-4">
              {filteredSkills.map((item) => {
                const maxExercises = 10;
                const percentage = Math.min(
                  100,
                  Math.round((item.completedExercises / maxExercises) * 100)
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">
                            {item.skill}
                          </h3>
                          {item.mastered && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Mastered
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                            <Globe2 className="w-3 h-3 text-slate-400" />
                            {item.language?.toUpperCase() || "EN"}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{item.level}</span>
                          <span>•</span>
                          <span>{item.completedExercises} / {maxExercises} exercises</span>
                        </div>
                      </div>

                      {/* XP Badge */}
                      <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs font-extrabold shrink-0 border border-indigo-100">
                        {item.xp} XP
                      </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
                        <span>Progress</span>
                        <span>{percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.mastered
                              ? "bg-emerald-500"
                              : "bg-indigo-600"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Search Empty State */
            <div className="py-8 text-center space-y-2">
              <p className="text-xs font-bold text-slate-700">
                No matching skills found
              </p>
              <p className="text-xs text-slate-400">
                Try searching with a different term or clear your search input.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Skeleton Loader Component
const ProgressSkeleton = () => (
  <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-pulse flex justify-between items-center">
        <div className="h-8 w-48 bg-slate-200 rounded-xl" />
        <div className="h-6 w-32 bg-slate-100 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm animate-pulse flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-pulse">
        <div className="h-6 w-36 bg-slate-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-50 rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);