import { useState, useMemo } from "react";
import { useGrammar } from "../hooks/useLearning";
import {
  BookOpen,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  CheckCircle2,
  Globe2,
  Lightbulb,
} from "lucide-react";

export const GrammarPage = () => {
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const { data, isLoading } = useGrammar({ language, level });

  const toggleExpand = (id: string) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  };

  // Filter grammar rules by search query
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter(
      (rule) =>
        rule.title.toLowerCase().includes(query) ||
        rule.description.toLowerCase().includes(query) ||
        rule.examples?.some((ex) => ex.toLowerCase().includes(query))
    );
  }, [data, searchQuery]);

  const getLevelBadgeColor = (levelStr: string) => {
    switch (levelStr?.toLowerCase()) {
      case "beginner":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "intermediate":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "advanced":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Grammar Rules</h1>
              <p className="text-sm text-slate-500">
                Master sentence structures, tenses, and usage patterns.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search rules or examples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>

          {/* Level Selector */}
          <div className="relative">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">All Proficiency Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <GrammarSkeleton />
        ) : filteredData && filteredData.length > 0 ? (
          <div className="space-y-4">
            {filteredData.map((rule) => {
              const isExpanded = expandedCardId === rule.id;

              return (
                <div
                  key={rule.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all overflow-hidden"
                >
                  {/* Card Header (Click to toggle expand) */}
                  <div
                    onClick={() => toggleExpand(rule.id)}
                    className="p-5 cursor-pointer flex items-start justify-between gap-4 select-none"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-800">
                          {rule.title}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getLevelBadgeColor(
                            rule.level
                          )}`}
                        >
                          {rule.level || "General"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Globe2 className="w-3 h-3 text-slate-400" />
                          {rule.language?.toUpperCase() || "EN"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>

                    <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Examples Section */}
                  <div
                    className={`px-5 pb-5 border-t border-slate-100 bg-slate-50/40 transition-all ${
                      isExpanded ? "block pt-4" : "hidden sm:block pt-4"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>Examples & Usage:</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {rule.examples && rule.examples.length > 0 ? (
                        rule.examples.map((ex, i) => (
                          <div
                            key={i}
                            className="bg-white p-3 rounded-xl border border-slate-200/60 text-xs text-slate-700 flex items-start gap-2.5 shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="font-medium leading-relaxed">{ex}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No examples available for this rule.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800">
                No Grammar Rules Found
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No rules matched your current filter selection or search query. Try clearing filters to explore more topics.
              </p>
            </div>
            <button
              onClick={() => {
                setLanguage("");
                setLevel("");
                setSearchQuery("");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm mt-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Skeleton Loader Component
const GrammarSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4 animate-pulse"
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="h-8 w-full bg-slate-50 rounded-xl" />
          <div className="h-8 w-full bg-slate-50 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);