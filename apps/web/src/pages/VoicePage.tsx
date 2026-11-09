import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  useVoiceRooms,
  useCreateVoiceRoom,
  useEndVoiceRoom,
  useJoinVoiceRoom,
  useLeaveVoiceRoom,
  type VoiceRoom,
} from "../hooks/useVoice";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Phone, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { VoiceRoomView } from "../components/voice/VoiceRoomView";
import type { MinimizedRoomData } from "../components/voice/VoiceRoomView.types";
import { useChatSocket } from "../hooks/useChat";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfirmationModal,
  FloatingMiniRoom,
  JoinPasswordModal,
} from "../components/voice/lobby/LobbyModals";
import {
  CreateRoomModal,
  type CreateRoomForm,
} from "../components/voice/lobby/CreateRoomModal";
import { RoomCard } from "../components/voice/lobby/RoomCard";
import { useRoomInterests, useToggleRoomInterest } from "../hooks/useNotifications";
import { LobbyHero } from "../components/voice/lobby/LobbyHero";
import {
  StatsStrip,
  YourRoomsShelf,
} from "../components/voice/lobby/LobbyOverview";
import { LobbyToolbar } from "../components/voice/lobby/LobbyToolbar";
import {
  EndedRooms,
  LobbyEmpty,
  LobbySkeleton,
} from "../components/voice/lobby/LobbyStates";
import { COLORS } from "../components/voice/lobby/lobbyTheme";
import {
  isRoomFull,
  participantCount,
  pickBestRoom,
  sortRooms,
} from "../components/voice/lobby/lobbyUtils";
import { useLobbyPrefs } from "../components/voice/lobby/useLobbyPrefs";
import { useLobbyShortcuts } from "../components/voice/lobby/useLobbyShortcuts";
import { useNow } from "../components/voice/lobby/useNow";

/** The server's message from a failed request, if it sent one */
const apiMessage = (error: unknown): string =>
  (error as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message ||
  (error as { message?: string })?.message ||
  "";

// ---- Main VoicePage Component ----
export const VoicePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams<{ roomId?: string }>();
  const queryClient = useQueryClient();
  const { data: rooms, isLoading, refetch } = useVoiceRooms();
  const createRoom = useCreateVoiceRoom();
  const endRoom = useEndVoiceRoom();
  const joinRoom = useJoinVoiceRoom();
  const leaveRoom = useLeaveVoiceRoom();
  useChatSocket("", user?.id || "");

  const prefs = useLobbyPrefs();
  const now = useNow();
  const searchRef = useRef<HTMLInputElement>(null);

  // State
  const [showCreate, setShowCreate] = useState(false);
  const [isCreateMinimized, setIsCreateMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for the current room ID
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    urlRoomId || null,
  );

  // Floating Mini Room state
  const [miniRoom, setMiniRoom] = useState<MinimizedRoomData | null>(null);
  const [showMiniRoom, setShowMiniRoom] = useState(false);

  // Rooms the user has left (the list can lag behind the server for a moment)
  const [leftRoomIds, setLeftRoomIds] = useState<Set<string>>(new Set());

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Sync activeRoomId with URL param
  useEffect(() => {
    if (urlRoomId) {
      setActiveRoomId(urlRoomId);
    } else {
      setActiveRoomId(null);
    }
  }, [urlRoomId]);

  // Auto-refresh rooms every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        refetch();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Handle browser back button: leave the room when navigating away
  useEffect(() => {
    const handlePopState = () => {
      if (activeRoomId && !showMiniRoom) {
        setLeftRoomIds((prev) => new Set(prev).add(activeRoomId));
        setActiveRoomId(null);
        navigate("/voice");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeRoomId, showMiniRoom, navigate]);

  const activeRooms = useMemo(
    () => (rooms ? rooms.filter((room) => room.status !== "ENDED") : []),
    [rooms],
  );

  const endedRooms = useMemo(
    () => (rooms ? rooms.filter((room) => room.status === "ENDED") : []),
    [rooms],
  );

  // Options for the language / topic filters come from the rooms that exist
  const languageOptions = useMemo(
    () =>
      Array.from(
        new Set(activeRooms.map((r) => r.language).filter(Boolean) as string[]),
      ).sort(),
    [activeRooms],
  );

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const room of activeRooms)
      for (const topic of room.topics || [])
        counts.set(topic, (counts.get(topic) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic]) => topic);
  }, [activeRooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = activeRooms.filter((room) => {
      if (
        q &&
        !(
          room.name.toLowerCase().includes(q) ||
          room.description?.toLowerCase().includes(q) ||
          room.creator?.name?.toLowerCase().includes(q) ||
          room.topics?.some((t) => t.toLowerCase().includes(q))
        )
      )
        return false;
      if (filterType && room.type !== filterType) return false;
      if (filterLanguage && room.language !== filterLanguage) return false;
      if (filterTopic && !room.topics?.includes(filterTopic)) return false;
      if (prefs.hideFull && isRoomFull(room)) return false;
      return true;
    });
    return sortRooms(result, prefs.sort);
  }, [
    activeRooms,
    searchQuery,
    filterType,
    filterLanguage,
    filterTopic,
    prefs.hideFull,
    prefs.sort,
  ]);

  // "Remind me" on scheduled rooms: how many people asked, and whether you did
  const scheduledIds = useMemo(
    () => filteredRooms.filter((r) => r.type === "SCHEDULED" && r.scheduledFor).map((r) => r.id),
    [filteredRooms],
  );
  const { data: interests } = useRoomInterests(scheduledIds);
  const toggleInterest = useToggleRoomInterest();
  const handleToggleReminder = (roomId: string) => {
    const interested = !interests?.[roomId]?.mine;
    toggleInterest.mutate(
      { roomId, interested },
      {
        onSuccess: () => toast.success(interested ? "We'll remind you 10 minutes before it starts" : "Reminder removed"),
        onError: () => toast.error("Couldn't update the reminder"),
      },
    );
  };

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (filterType ? 1 : 0) +
    (filterLanguage ? 1 : 0) +
    (filterTopic ? 1 : 0) +
    (prefs.hideFull ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterType(null);
    setFilterLanguage(null);
    setFilterTopic(null);
    prefs.setHideFull(false);
  };

  const isUserInRoom = useCallback(
    (room: VoiceRoom) => {
      if (!user) return false;
      if (leftRoomIds.has(room.id)) return false;
      return room.participants?.some((p) => p.userId === user.id) || false;
    },
    [user, leftRoomIds],
  );

  const handleCreate = async (data: CreateRoomForm) => {
    try {
      const payload: Parameters<typeof createRoom.mutateAsync>[0] = {
        name: data.name,
        description: data.description,
        type: data.type,
        maxParticipants: data.maxParticipants,
        language: data.language,
        topics: data.topics || [],
      };

      if (data.type === "PRIVATE") {
        payload.password = data.password;
      }
      if (data.type === "SCHEDULED" && data.scheduledFor) {
        payload.scheduledFor = data.scheduledFor;
      }

      const newRoom = await createRoom.mutateAsync(payload);

      if (!newRoom || !newRoom.id) {
        toast.error("Room creation failed. Please try again.");
        return;
      }

      setShowCreate(false);
      setIsCreateMinimized(false);

      // A scheduled room starts later: stay in the lobby so it shows up there
      if (data.type === "SCHEDULED") {
        toast.success("🗓 Room scheduled. Share the link so people can join.");
        await refetch();
        return;
      }

      toast.success("🎉 Room created! Invite others to join.");

      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(newRoom.id);
        return newSet;
      });

      setActiveRoomId(newRoom.id);
      navigate(`/voice/${newRoom.id}`);
    } catch (error) {
      console.error("Create room error:", error);
      toast.error(apiMessage(error) || "Failed to create room");
    }
  };

  // Handle joining/rejoining a room
  const handleJoinRoom = async (room: VoiceRoom) => {
    // If user is already in the room, just navigate directly
    if (isUserInRoom(room)) {
      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(room.id);
        return newSet;
      });
      setActiveRoomId(room.id);
      navigate(`/voice/${room.id}`);
      return;
    }

    if (room.status === "ENDED") {
      toast.error("This room has ended");
      refetch();
      return;
    }

    if (participantCount(room) >= room.maxParticipants) {
      toast.error("This room is full");
      return;
    }

    if (room.type === "PRIVATE") {
      setJoinTarget({ id: room.id, name: room.name });
      setJoinPassword("");
      setJoinError("");
      return;
    }

    try {
      setJoiningRoomId(room.id);
      await joinRoom.mutateAsync(room.id);

      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(room.id);
        return newSet;
      });

      await refetch();
      setActiveRoomId(room.id);
      navigate(`/voice/${room.id}`);
    } catch (error) {
      const errorMessage = apiMessage(error);
      if (
        errorMessage.includes("already in room") ||
        errorMessage.includes("already in the room")
      ) {
        await refetch();
        setLeftRoomIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(room.id);
          return newSet;
        });
        setActiveRoomId(room.id);
        navigate(`/voice/${room.id}`);
        return;
      }
      toast.error(apiMessage(error) || "Failed to join room");
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleConfirmJoinWithPassword = async () => {
    if (!joinTarget) return;
    if (!joinPassword.trim()) {
      setJoinError("Password is required");
      return;
    }
    try {
      setJoiningRoomId(joinTarget.id);
      await joinRoom.mutateAsync(joinTarget.id);

      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(joinTarget.id);
        return newSet;
      });

      await refetch();
      setActiveRoomId(joinTarget.id);
      navigate(`/voice/${joinTarget.id}`, {
        state: { password: joinPassword },
      });
      setJoinTarget(null);
      setJoinPassword("");
      setJoinError("");
    } catch (error) {
      toast.error(apiMessage(error) || "Failed to join room");
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleEnd = async (roomId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "End Room?",
      message:
        "Are you sure you want to end this room? This action cannot be undone and all participants will be disconnected.",
      confirmText: "Yes, End Room",
      confirmColor: COLORS.danger,
      onConfirm: async () => {
        try {
          await endRoom.mutateAsync(roomId);
          toast.success("Room ended");
          await refetch();

          setLeftRoomIds((prev) => new Set(prev).add(roomId));

          if (miniRoom?.id === roomId) {
            setShowMiniRoom(false);
            setMiniRoom(null);
          }
          if (activeRoomId === roomId) {
            setActiveRoomId(null);
            navigate("/voice");
          }
        } catch (error) {
          toast.error(apiMessage(error) || "Failed to end room");
        }
      },
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refetch]);

  const handleRoomLeft = async () => {
    const roomId = activeRoomId;

    if (!roomId) {
      navigate("/voice");
      return;
    }

    try {
      setLeftRoomIds((prev) => new Set(prev).add(roomId));

      await refetch();
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      queryClient.refetchQueries({ queryKey: ["voice-rooms"] });

      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      // The recap of the session you just left (it shows a friendly note if there was too little to recap)
      navigate(`/recap/${roomId}`);
    } catch (error) {
      console.error("Error refreshing after leaving room:", error);
      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      navigate(`/recap/${roomId}`);
    }
  };

  // Close the minimized room
  const handleCloseMiniRoom = async () => {
    if (!miniRoom?.id) return;

    const roomId = miniRoom.id;

    try {
      await leaveRoom.mutateAsync(roomId);

      setLeftRoomIds((prev) => new Set(prev).add(roomId));
      await refetch();

      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      navigate("/voice");

      toast.success("Left room");
    } catch (error) {
      console.error("Error leaving minimized room:", error);
      toast.error(apiMessage(error) || "Failed to leave room");
    }
  };

  const handleMinimizeRoom = (roomData: MinimizedRoomData) => {
    setMiniRoom(roomData);
    setShowMiniRoom(true);
  };

  const handleMaximizeRoom = () => {
    if (!miniRoom) return;

    setLeftRoomIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(miniRoom.id);
      return newSet;
    });

    setShowMiniRoom(false);
    setActiveRoomId(miniRoom.id);
    navigate(`/voice/${miniRoom.id}`);
  };

  const copyRoomLink = (roomId: string) => {
    navigator.clipboard
      .writeText(`${window.location.origin}/voice/${roomId}`)
      .then(() => toast.success("🔗 Room link copied!"))
      .catch(() => toast.error("Could not copy the link"));
  };

  // While minimized, the room component stays mounted but the room list
  // becomes visible underneath it.
  const showRoomView = !!activeRoomId && !showMiniRoom;

  // ---- Lobby overview data ----
  const hostingIds = useMemo(
    () =>
      new Set(
        activeRooms.filter((r) => r.creatorId === user?.id).map((r) => r.id),
      ),
    [activeRooms, user?.id],
  );
  const insideIds = useMemo(
    () => new Set(activeRooms.filter(isUserInRoom).map((r) => r.id)),
    [activeRooms, isUserInRoom],
  );
  const shelfRooms = useMemo(
    () =>
      activeRooms.filter(
        (r) =>
          hostingIds.has(r.id) ||
          insideIds.has(r.id) ||
          prefs.favorites.has(r.id),
      ),
    [activeRooms, hostingIds, insideIds, prefs.favorites],
  );
  const peopleTalking = useMemo(
    () => activeRooms.reduce((sum, r) => sum + participantCount(r), 0),
    [activeRooms],
  );
  const featured = useMemo(() => {
    const top = sortRooms(
      activeRooms.filter(
        (r) => r.type !== "PRIVATE" && r.type !== "SCHEDULED" && participantCount(r) > 0,
      ),
      "active",
    )[0];
    return top ?? null;
  }, [activeRooms]);
  const quickRoom = useMemo(
    () => pickBestRoom(activeRooms, user?.id, filterLanguage),
    [activeRooms, user?.id, filterLanguage],
  );

  const openCreate = useCallback(() => setShowCreate(true), []);

  useLobbyShortcuts(
    {
      "/": () => searchRef.current?.focus(),
      n: openCreate,
      g: () => prefs.setViewMode(prefs.viewMode === "grid" ? "list" : "grid"),
      r: () => void handleRefresh(),
    },
    !showRoomView && !showCreate && !joinTarget && !confirmModal.isOpen,
  );

  const isList = prefs.viewMode === "list";

  return (
    <div
      className="relative min-h-screen font-sans overflow-x-hidden"
      style={{ background: COLORS.void }}
    >
      {/* Ambient glow behind the lobby */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: `radial-gradient(60% 80% at 15% 0%, color-mix(in srgb, ${COLORS.purple} 12.2%, transparent) 0%, transparent 70%), radial-gradient(50% 70% at 90% 5%, color-mix(in srgb, ${COLORS.live} 9.4%, transparent) 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!showRoomView && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <span
                  className="text-[11px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
                  style={{ background: COLORS.liveDim, color: COLORS.live }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: COLORS.live }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ background: COLORS.live }}
                    />
                  </span>
                  Live Conversations
                </span>
                <h1
                  className="font-serif text-3xl sm:text-4xl mt-3"
                  style={{ color: COLORS.textPrimary }}
                >
                  Voice Rooms
                </h1>
                <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
                  Practise speaking with real people, any time of day.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("/call")}
                title="Talk one-to-one with someone at your level"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: COLORS.live, color: COLORS.live }}
              >
                <Phone className="h-4 w-4" />
                Random call
              </button>
              <button
                onClick={openCreate}
                title="Create room (N)"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.spotlight}, var(--sx-bg-ffc857))`,
                  color: COLORS.void,
                  boxShadow: `0 10px 30px -10px ${COLORS.spotlight}`,
                }}
              >
                <Plus className="w-4 h-4" />
                Create Room
              </button>
              </div>
            </div>

            <LobbyHero
              featured={featured}
              quickRoom={quickRoom}
              isJoiningFeatured={!!featured && joiningRoomId === featured.id}
              onJoinFeatured={() => featured && handleJoinRoom(featured)}
              onQuickJoin={() => quickRoom && handleJoinRoom(quickRoom)}
              onCreate={openCreate}
            />

            <StatsStrip
              liveRooms={activeRooms.length}
              peopleTalking={peopleTalking}
              hosting={hostingIds.size}
              inside={insideIds.size}
            />

            <YourRoomsShelf
              rooms={shelfRooms}
              hostingIds={hostingIds}
              insideIds={insideIds}
              pinnedIds={prefs.favorites}
              onOpen={handleJoinRoom}
            />

            <LobbyToolbar
              searchRef={searchRef}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              filterType={filterType}
              onFilterType={setFilterType}
              language={filterLanguage}
              languages={languageOptions}
              onLanguage={setFilterLanguage}
              topic={filterTopic}
              topics={topicOptions}
              onTopic={setFilterTopic}
              sort={prefs.sort}
              onSort={prefs.setSort}
              hideFull={prefs.hideFull}
              onHideFull={prefs.setHideFull}
              viewMode={prefs.viewMode}
              onViewMode={prefs.setViewMode}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              activeFilters={activeFilterCount}
              onClear={clearFilters}
              shown={filteredRooms.length}
              total={activeRooms.length}
            />

            {isLoading ? (
              <LobbySkeleton list={isList} />
            ) : (
              <>
                {filteredRooms.length > 0 ? (
                  <div
                    className={
                      isList
                        ? "space-y-3"
                        : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                    }
                  >
                    {filteredRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        variant={prefs.viewMode}
                        isCreator={room.creatorId === user?.id}
                        isUserInRoom={isUserInRoom(room)}
                        isJoining={joiningRoomId === room.id}
                        isFavorite={prefs.favorites.has(room.id)}
                        now={now}
                        onJoin={() => handleJoinRoom(room)}
                        onEnd={() => handleEnd(room.id)}
                        onCopyLink={() => copyRoomLink(room.id)}
                        onToggleFavorite={() => prefs.toggleFavorite(room.id)}
                        reminder={interests?.[room.id]}
                        onToggleReminder={() => handleToggleReminder(room.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <LobbyEmpty
                    filtered={activeFilterCount > 0 && activeRooms.length > 0}
                    onCreate={openCreate}
                    onClear={clearFilters}
                  />
                )}

                <EndedRooms rooms={endedRooms} />
              </>
            )}
          </>
        )}
      </div>

      {/* Persistent VoiceRoomView */}
      {activeRoomId && (
        <div
          className={
            showMiniRoom
              ? "fixed inset-0 z-0 opacity-0 pointer-events-none"
              : "fixed inset-0 z-50 bg-black/95"
          }
          aria-hidden={showMiniRoom}
        >
          <VoiceRoomView
            key={activeRoomId}
            roomId={activeRoomId}
            onLeave={handleRoomLeft}
            onMinimize={handleMinimizeRoom}
          />
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateRoomModal
            isOpen={showCreate}
            onClose={() => {
              setShowCreate(false);
              setIsCreateMinimized(false);
            }}
            onCreate={handleCreate}
            isPending={createRoom.isPending}
            onMinimize={() => setIsCreateMinimized(true)}
            isMinimized={isCreateMinimized}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.isOpen && (
          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() =>
              setConfirmModal((prev) => ({ ...prev, isOpen: false }))
            }
            onConfirm={confirmModal.onConfirm}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            confirmColor={confirmModal.confirmColor}
          />
        )}
      </AnimatePresence>

      {/* Floating Mini Room */}
      <AnimatePresence>
        {showMiniRoom && miniRoom && (
          <FloatingMiniRoom
            room={miniRoom}
            onJoin={handleMaximizeRoom}
            onClose={handleCloseMiniRoom}
            onMaximize={handleMaximizeRoom}
          />
        )}
      </AnimatePresence>

      {/* Join Password Modal */}
      <AnimatePresence>
        {joinTarget && (
          <JoinPasswordModal
            roomName={joinTarget.name}
            password={joinPassword}
            error={joinError}
            show={showJoinPassword}
            joining={joiningRoomId !== null}
            onPasswordChange={(value) => {
              setJoinPassword(value);
              if (joinError) setJoinError("");
            }}
            onToggleShow={() => setShowJoinPassword((p) => !p)}
            onConfirm={handleConfirmJoinWithPassword}
            onClose={() => setJoinTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoicePage;
