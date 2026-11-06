// apps/web/src/components/voice/lobby/LobbyToolbar.tsx
import React from "react";
import { LayoutGrid, List, RefreshCw, Search, X } from "lucide-react";
import { COLORS, TYPE_ACCENTS, TYPE_LABELS } from "./lobbyTheme";
import { SORT_LABELS, type SortKey } from "./lobbyUtils";

interface LobbyToolbarProps {
  searchRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearch: (value: string) => void;
  filterType: string | null;
  onFilterType: (type: string | null) => void;
  language: string | null;
  languages: string[];
  onLanguage: (language: string | null) => void;
  topic: string | null;
  topics: string[];
  onTopic: (topic: string | null) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  hideFull: boolean;
  onHideFull: (value: boolean) => void;
  viewMode: "grid" | "list";
  onViewMode: (mode: "grid" | "list") => void;
  refreshing: boolean;
  onRefresh: () => void;
  activeFilters: number;
  onClear: () => void;
  shown: number;
  total: number;
}

const selectStyle = {
  background: COLORS.surface,
  borderColor: COLORS.border,
  color: COLORS.textPrimary,
};

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border"
    style={{ borderColor: COLORS.border, color: COLORS.textSecondary }}
  >
    {children}
  </kbd>
);

export const LobbyToolbar: React.FC<LobbyToolbarProps> = (props) => {
  const {
    searchRef,
    searchQuery,
    onSearch,
    filterType,
    onFilterType,
    language,
    languages,
    onLanguage,
    topic,
    topics,
    onTopic,
    sort,
    onSort,
    hideFull,
    onHideFull,
    viewMode,
    onViewMode,
    refreshing,
    onRefresh,
    activeFilters,
    onClear,
    shown,
    total,
  } = props;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: COLORS.textMuted }}
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search rooms, topics, hosts..."
            aria-label="Search rooms"
            className="w-full pl-10 pr-12 py-2.5 rounded-xl border outline-none text-sm transition-colors focus:border-[#F5A623]"
            style={selectStyle}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {searchQuery ? (
              <button
                onClick={() => onSearch("")}
                aria-label="Clear search"
                style={{ color: COLORS.textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Kbd>/</Kbd>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="sr-only" htmlFor="lobby-sort">
            Sort rooms
          </label>
          <select
            id="lobby-sort"
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="px-3 py-2.5 rounded-xl border outline-none text-sm"
            style={selectStyle}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>

          {languages.length > 0 && (
            <>
              <label className="sr-only" htmlFor="lobby-language">
                Filter by language
              </label>
              <select
                id="lobby-language"
                value={language ?? ""}
                onChange={(e) => onLanguage(e.target.value || null)}
                className="px-3 py-2.5 rounded-xl border outline-none text-sm"
                style={selectStyle}
              >
                <option value="">All languages</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </>
          )}

          <div
            className="flex items-center gap-1 rounded-xl p-1"
            style={{ background: "var(--sx-bg-255-255-255-50)" }}
          >
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewMode(mode)}
                aria-pressed={viewMode === mode}
                aria-label={`${mode} view`}
                title={`${mode === "grid" ? "Grid" : "List"} view (G)`}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === mode ? "bg-white/10" : ""}`}
                style={{
                  color: viewMode === mode ? COLORS.textPrimary : COLORS.textMuted,
                }}
              >
                {mode === "grid" ? (
                  <LayoutGrid className="w-4 h-4" />
                ) : (
                  <List className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ color: COLORS.textMuted }}
            title="Refresh (R)"
            aria-label="Refresh rooms"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", ...Object.keys(TYPE_ACCENTS)] as const).map((type) => {
          const selected = type === "ALL" ? filterType === null : filterType === type;
          const color = type === "ALL" ? COLORS.textPrimary : TYPE_ACCENTS[type];
          return (
            <button
              key={type}
              onClick={() => onFilterType(type === "ALL" ? null : filterType === type ? null : type)}
              aria-pressed={selected}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                background: selected ? `color-mix(in srgb, ${color} 14.9%, transparent)` : "transparent",
                borderColor: selected ? color : COLORS.border,
                color: selected ? color : COLORS.textMuted,
              }}
            >
              {type === "ALL" ? "All" : TYPE_LABELS[type]}
            </button>
          );
        })}

        <span className="w-px h-5 mx-1" style={{ background: COLORS.border }} />

        <label
          className="inline-flex items-center gap-2 text-xs cursor-pointer select-none"
          style={{ color: COLORS.textMuted }}
        >
          <input
            type="checkbox"
            checked={hideFull}
            onChange={(e) => onHideFull(e.target.checked)}
            className="accent-[var(--sx-bg-f5a623)]"
          />
          Hide full rooms
        </label>

        {topics.map((t) => (
          <button
            key={t}
            onClick={() => onTopic(topic === t ? null : t)}
            aria-pressed={topic === t}
            className="px-2.5 py-1 rounded-full text-[11px] border transition-all"
            style={{
              background: topic === t ? COLORS.spotlightDim : "transparent",
              borderColor: topic === t ? COLORS.spotlight : COLORS.border,
              color: topic === t ? COLORS.spotlight : COLORS.textSecondary,
            }}
          >
            #{t}
          </button>
        ))}

        <span
          className="ml-auto text-xs flex items-center gap-3"
          style={{ color: COLORS.textMuted }}
          aria-live="polite"
        >
          {activeFilters > 0 && (
            <button
              onClick={onClear}
              className="underline underline-offset-2 hover:opacity-80"
              style={{ color: COLORS.spotlight }}
            >
              Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
          Showing {shown} of {total}
        </span>
      </div>
    </div>
  );
};
