// apps/web/src/components/voice/participants/ParticipantGrid.tsx

import React, { useMemo } from "react";
import { Users, Search, UserRoundSearch } from "lucide-react";
import { cn } from "../../../lib/utils";
import { THEME } from "../VoiceRoomView.theme";
import { ParticipantCard } from "./ParticipantCard";
import { EmptyParticipantState } from "../shared/EmptyParticipantState";
import type { RoomParticipant } from "../VoiceRoomView.types";

interface ParticipantGridProps {
  participants: any[];
  isHost: boolean;
  isModerator: boolean;
  currentUserId?: string;
  hostId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: "all" | "online" | "speaking" | "raised";
  onFilterChange: (filter: "all" | "online" | "speaking" | "raised") => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  favoriteParticipants: Set<string>;
  onToggleFavorite: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onUnmuteUser: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onPromoteHost: (userId: string) => void;
  onSendMessage: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  showChat: boolean;
  className?: string;
  /** Called when empty state's "Invite friends" is clicked */
  onInvite?: () => void;
  /** Called when the user picks a suggested topic from the empty state */
  onPickTopic?: (topic: string) => void;
  /** Called when a listener wants to suggest a correction to a speaker */
  onCorrect?: (userId: string, userName: string) => void;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  isHost,
  isModerator,
  currentUserId,
  hostId,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  showSearch,
  onToggleSearch,
  favoriteParticipants,
  onToggleFavorite,
  onMuteUser,
  onUnmuteUser,
  onKickUser,
  onPromoteHost,
  onSendMessage,
  onViewProfile,
  showChat,
  className,
  onInvite,
  onPickTopic,
}) => {
  // Dynamic language list from participants
  const roomLanguages = useMemo(() => {
    const set = new Set<string>();
    participants.forEach((p: any) => {
      if (p.nativeLanguage) set.add(String(p.nativeLanguage));
      if (p.learningLanguage) set.add(String(p.learningLanguage));
    });
    return Array.from(set).sort();
  }, [participants]);

  const [langFilter, setLangFilter] = React.useState<string>("all");

  const filteredParticipants = participants
    .filter((p: any) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return [p.name, p.nativeLanguage, p.learningLanguage, p.country, p.level]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .filter((p: any) => {
      if (filter === "online") return p.isOnline === true;
      if (filter === "speaking") return p.isSpeaking === true;
      if (filter === "raised") return p.raisedHand === true;
      return true;
    })
    .filter((p: any) => {
      if (langFilter === "all") return true;
      return (
        p.nativeLanguage === langFilter || p.learningLanguage === langFilter
      );
    })
    .sort((a: any, b: any) => {
      if (a.role === "HOST" && b.role !== "HOST") return -1;
      if (b.role === "HOST" && a.role !== "HOST") return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const onlineParticipants = participants.filter(
    (p: any) => p.isOnline === true,
  );

  return (
    <section
      className={cn(
        "flex-1 min-w-0 px-4 py-4 transition-all duration-300 overflow-y-auto",
        className,
      )}
      style={{
        background: `radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.04), transparent 70%)`,
      }}
    >
      {/* Toolbar */}
      <div
        className="mb-4 rounded-xl border p-3"
        style={{
          background: THEME.colors.background.card,
          borderColor: THEME.colors.border.primary,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <Users
              className="w-4 h-4"
              style={{ color: THEME.colors.accent.tertiary }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: THEME.colors.text.primary }}
            >
              {participants.length} in room
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(52, 211, 153, 0.1)",
                color: THEME.colors.status.online,
              }}
            >
              {onlineParticipants.length} online
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(["all", "online", "speaking", "raised"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className="px-2.5 py-1 rounded-full text-[9px] capitalize transition-all"
                style={{
                  background:
                    filter === f ? "rgba(99,102,241,0.15)" : "transparent",
                  color:
                    filter === f
                      ? THEME.colors.text.primary
                      : THEME.colors.text.muted,
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleSearch}
            className="p-1.5 rounded-lg hover:bg-white/5"
            style={{
              color: showSearch
                ? THEME.colors.accent.primary
                : THEME.colors.text.muted,
            }}
            title="Search participants"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative mt-2">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: THEME.colors.text.muted }}
            />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, language, country..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style={{
                background: THEME.colors.background.primary,
                borderColor: THEME.colors.border.primary,
                color: THEME.colors.text.primary,
              }}
            />
          </div>
        )}
      </div>

      {/* Dynamic language chips */}
      {roomLanguages.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span
            className="text-[10px] font-medium"
            style={{ color: THEME.colors.text.muted }}
          >
            Languages
          </span>
          <button
            type="button"
            onClick={() => setLangFilter("all")}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
            style={{
              background:
                langFilter === "all"
                  ? "rgba(129,140,248,0.18)"
                  : THEME.colors.background.tertiary,
              color:
                langFilter === "all"
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.secondary,
              border: `1px solid ${
                langFilter === "all"
                  ? "rgba(129,140,248,0.35)"
                  : THEME.colors.border.primary
              }`,
            }}
          >
            All
          </button>
          {roomLanguages.slice(0, 8).map((lang: string) => (
            <button
              type="button"
              key={lang}
              onClick={() =>
                setLangFilter((prev) => (prev === lang ? "all" : lang))
              }
              className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background:
                  langFilter === lang
                    ? "rgba(129,140,248,0.18)"
                    : THEME.colors.background.tertiary,
                color:
                  langFilter === lang
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.secondary,
                border: `1px solid ${
                  langFilter === lang
                    ? "rgba(129,140,248,0.35)"
                    : THEME.colors.border.primary
                }`,
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Grid — centered vertically when sparse */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto min-h-[50vh] place-content-center">
        {filteredParticipants.length === 0 ? (
          <div className="col-span-full">
            <EmptyParticipantState
              variant={
                searchQuery
                  ? "search"
                  : filter !== "all" || langFilter !== "all"
                    ? "filter"
                    : participants.length === 0
                      ? "no-participants"
                      : "no-speakers"
              }
              isHost={isHost}
              isModerator={isModerator}
              searchQuery={searchQuery}
              onInvite={onInvite}
              onPickTopic={onPickTopic}
              onClearFilters={() => {
                onSearchChange("");
                onFilterChange("all");
              }}
              onRaiseHand={() => {
                /* parent handles via socket — will be passed later if needed */
              }}
            />
          </div>
        ) : (
          filteredParticipants.map((p: any) => {
            const isParticipantHost = hostId === p.id || p.role === "HOST";
            const isCurrentUser = p.id === currentUserId;

            return (
              <ParticipantCard
                key={p.id}
                participant={p}
                isHost={isParticipantHost}
                isCurrentUser={isCurrentUser}
                isModerator={isModerator}
                isFavorite={favoriteParticipants.has(p.id)}
                onMute={() =>
                  p.isMuted ? onUnmuteUser(p.id) : onMuteUser(p.id)
                }
                onKick={() => onKickUser(p.id)}
                onPromote={() => onPromoteHost(p.id)}
                onFollow={() => onToggleFavorite(p.id)}
                onSendMessage={() => onSendMessage(p.id)}
                onViewProfile={() => onViewProfile(p.id)}
                size="sm"
              />
            );
          })
        )}
      </div>
    </section>
  );
};

export default ParticipantGrid;
