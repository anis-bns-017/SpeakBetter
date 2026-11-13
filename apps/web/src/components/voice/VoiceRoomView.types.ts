// apps/web/src/components/voice/VoiceRoomView.types.ts

// Define VoiceMessage locally instead of importing from useVoice
export interface VoiceMessage {
  id: string;
  content: string;
  type: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  chatId?: string;
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyToId?: string;
  replyTo?: VoiceMessage;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceRoomViewProps {
  roomId: string;
  onLeave: () => void;
  onMinimize?: (roomData: MinimizedRoomData) => void;
  onShare?: (roomId: string) => void;
  onInvite?: (roomId: string) => void;
}

export interface MinimizedRoomData {
  id: string;
  name: string;
  participants: RoomParticipant[];
  type: string;
  participantCount: number;
}

export interface RoomParticipant {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  bio?: string;
  interests?: string[];
  isOnline: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  raisedHand: boolean;
  joinedAt: string;
  role: "HOST" | "MODERATOR" | "MEMBER" | "LISTENER";
  isListening: boolean;
  audioLevel: number;
  isVerified?: boolean;
  isPremium?: boolean;
  age?: number;
  gender?: string;
  timezone?: string;
}

export interface LanguageFilter {
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  country?: string;
}

export interface VoiceRoomState {
  isMuted: boolean;
  isDeafened: boolean;
  volume: number;
  showChat: boolean;
  showParticipants: boolean;
  showLiveStats: boolean;
  showRoomDetails: boolean;
  showCommandCenter: boolean;
  activeTab: "chat" | "participants" | "settings";
  isRecording: boolean;
  isRaisingHand: boolean;
  isFullscreen: boolean;
  showLeaveConfirm: boolean;
  showShortcuts: boolean;
}

export interface ParticipantFilters {
  search: string;
  status: "all" | "online" | "speaking" | "raised" | "muted";
  language?: string;
  role?: "host" | "moderator" | "member";
}

export interface MessageFilters {
  search: string;
  type?: "text" | "image" | "voice" | "system";
  hasReactions?: boolean;
  isPinned?: boolean;
}

export interface VoiceRoomStats {
  totalParticipants: number;
  onlineParticipants: number;
  speakingCount: number;
  messageCount: number;
  duration: number;
  premiumCount: number;
  verifiedCount: number;
  languages: string[];
  countries: string[];
  averageAudioLevel: number;
  peakParticipants: number;
}

