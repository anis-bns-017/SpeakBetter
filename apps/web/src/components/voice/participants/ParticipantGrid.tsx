// apps/web/src/components/voice/participants/ParticipantGrid.tsx

import React, { useMemo } from "react";
import { Users, Search } from "lucide-react";
import { cn } from "../../../lib/utils";
import { THEME } from "../VoiceRoomView.theme";
import { ParticipantCard } from "./ParticipantCard";
import { EmptyParticipantState } from "../shared/EmptyParticipantState";
import type { RoomParticipant } from "../VoiceRoomView.types";
import { tr } from "../../../i18n/core";

/** The room view may not know yet whether someone is online */
type GridParticipant = Pick<RoomParticipant, "id" | "userId" | "name"> &
  Partial<Omit<RoomParticipant, "id" | "userId" | "name" | "role">> & { role?: string };

interface ParticipantGridProps {
  participants: GridParticipant[];
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
  /** Stage rooms split people into "On stage" and "Audience" */
  isStageRoom?: boolean;
  onInviteToStage?: (userId: string) => void;
  onMoveToAudience?: (userId: string) => void;
}

const STAGE_ROLES = new Set(["HOST", "MODERATOR", "SPEAKER", "STAGE_SPEAKER"]);

const SectionLabel: React.FC<{ title: string; count: number; hint?: string }> = ({ title, count, hint }) => (
  <div className="col-span-full flex items-center gap-2.5 mt-3">
    <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: THEME.colors.text.secondary }}>
      {tr(title)}
    </span>
    <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--sx-bg-255-255-255-60)", color: THEME.colors.text.secondary }}>
      {count}
    </span>
    {hint && <span className="text-xs" style={{ color: THEME.colors.text.muted }}>{tr(hint)}</span>}
    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${THEME.colors.border.primary}, transparent)` }} />
  </div>
);

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
  className,
  onInvite,
  onPickTopic,
  isStageRoom = false,
  onInviteToStage,
  onMoveToAudience,
}) => {
  const isOnStage = (p: GridParticipant) =>
    hostId === p.id || STAGE_ROLES.has(String(p.role || "").toUpperCase());
  // Dynamic language list from participants
  const roomLanguages = useMemo(() => {
    const set = new Set<string>();
    participants.forEach((p) => {
      if (p.nativeLanguage) set.add(String(p.nativeLanguage));
      if (p.learningLanguage) set.add(String(p.learningLanguage));
    });
    return Array.from(set).sort();
  }, [participants]);

  const [langFilter, setLangFilter] = React.useState<string>("all");

  const filteredParticipants = participants
    .filter((p) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return [p.name, p.nativeLanguage, p.learningLanguage, p.country, p.level]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .filter((p) => {
      if (filter === "online") return p.isOnline === true;
      if (filter === "speaking") return p.isSpeaking === true;
      if (filter === "raised") return p.raisedHand === true;
      return true;
    })
    .filter((p) => {
      if (langFilter === "all") return true;
      return (
        p.nativeLanguage === langFilter || p.learningLanguage === langFilter
      );
    })
    .sort((a, b) => {
      const aHost = hostId === a.id || a.role === "HOST";
      const bHost = hostId === b.id || b.role === "HOST";
      if (aHost !== bHost) return aHost ? -1 : 1;
      // Raised hands first in the audience, so hosts see them right away
      if (Boolean(a.raisedHand) !== Boolean(b.raisedHand)) return a.raisedHand ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const stageParticipants = isStageRoom ? filteredParticipants.filter(isOnStage) : filteredParticipants;
  const audienceParticipants = isStageRoom ? filteredParticipants.filter((p) => !isOnStage(p)) : [];

  const renderCard = (p: GridParticipant, size: "sm" | "md" | "lg" = "md") => {
    const isParticipantHost = hostId === p.id || p.role === "HOST";
    const isCurrentUser = p.id === currentUserId;
    const onStage = isOnStage(p);
    const canManageStage = isStageRoom && isModerator && !isParticipantHost && !isCurrentUser;

    return (
      <ParticipantCard
        key={p.id}
        participant={p}
        isHost={isParticipantHost}
        isCurrentUser={isCurrentUser}
        isModerator={isModerator}
        isFavorite={favoriteParticipants.has(p.id)}
        onMute={() => (p.isMuted ? onUnmuteUser(p.id) : onMuteUser(p.id))}
        onKick={() => onKickUser(p.id)}
        onPromote={() => onPromoteHost(p.id)}
        onFollow={() => onToggleFavorite(p.id)}
        onSendMessage={() => onSendMessage(p.id)}
        onViewProfile={() => onViewProfile(p.id)}
        onStageAction={
          canManageStage
            ? onStage
              ? onMoveToAudience && (() => onMoveToAudience(p.id))
              : onInviteToStage && (() => onInviteToStage(p.id))
            : undefined
        }
        stageActionKind={onStage ? "remove" : "invite"}
        size={size}
      />
    );
  };

  const onlineParticipants = participants.filter(
    (p) => p.isOnline === true,
  );

  return (
    <section
      className={cn(
        "flex-1 min-w-0 px-4 py-4 transition-all duration-300 overflow-y-auto",
        className,
      )}
      style={{
        background: `radial-gradient(ellipse at 50% 20%, rgba(79,102,200,0.04), transparent 70%)`,
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
              {participants.length} {" "}{tr("in room")}</span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(52, 211, 153, 0.1)",
                color: THEME.colors.status.online,
              }}
            >
              {onlineParticipants.length} {" "}{tr("online")}</span>
          </div>

          <div className="flex items-center gap-1">
            {(["all", "online", "speaking", "raised"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className="px-2.5 py-1 rounded-full text-[9px] capitalize transition-all"
                style={{
                  background:
                    filter === f ? "rgba(79,102,200,0.15)" : "transparent",
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
            title={tr("Search participants")}
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
              placeholder={tr("Search by name, language, country...")}
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
            className="text-[11px] font-medium"
            style={{ color: THEME.colors.text.muted }}
          >
            {tr("Languages")}</span>
          <button
            type="button"
            onClick={() => setLangFilter("all")}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background:
                langFilter === "all"
                  ? "rgba(142,163,232,0.18)"
                  : THEME.colors.background.tertiary,
              color:
                langFilter === "all"
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.secondary,
              border: `1px solid ${
                langFilter === "all"
                  ? "rgba(142,163,232,0.35)"
                  : THEME.colors.border.primary
              }`,
            }}
          >
            {tr("All")}</button>
          {roomLanguages.slice(0, 8).map((lang: string) => (
            <button
              type="button"
              key={lang}
              onClick={() =>
                setLangFilter((prev) => (prev === lang ? "all" : lang))
              }
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
              style={{
                background:
                  langFilter === lang
                    ? "rgba(142,163,232,0.18)"
                    : THEME.colors.background.tertiary,
                color:
                  langFilter === lang
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.secondary,
                border: `1px solid ${
                  langFilter === lang
                    ? "rgba(142,163,232,0.35)"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-7 max-w-5xl mx-auto min-h-[50vh] place-content-center">
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
        ) : isStageRoom ? (
          <>
            <SectionLabel title={tr("On stage")} count={stageParticipants.length} />
            {stageParticipants.map((p) => renderCard(p, "lg"))}
            <SectionLabel
              title={tr("Audience")}
              count={audienceParticipants.length}
              hint={
                isModerator && audienceParticipants.some((p) => p.raisedHand)
                  ? tr("Raised hands are listed first")
                  : undefined
              }
            />
            {audienceParticipants.length === 0 ? (
              <p className="col-span-full text-xs py-2" style={{ color: THEME.colors.text.muted }}>
                {tr("Everyone here is on stage.")}</p>
            ) : (
              audienceParticipants.map((p) => renderCard(p, "sm"))
            )}
          </>
        ) : (
          filteredParticipants.map((p) => renderCard(p, "md"))
        )}
      </div>
    </section>
  );
};

export default ParticipantGrid;
