// ============ CHAT TYPES ============

export type ChatType = "PRIVATE" | "GROUP" | "CHANNEL" | "THREAD";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "FILE"
  | "VOICE_NOTE"
  | "GIF"
  | "STICKER"
  | "LOCATION"
  | "CONTACT"
  | "POLL"
  | "SYSTEM"
  /** Language correction of the message in replyToId; content = corrected text */
  | "CORRECTION";

export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface ChatParticipant {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastReadAt?: string;
  mutedUntil?: string | null;
  isPinned?: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  avatarUrl?: string;
  participants: ChatParticipant[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
  isGroup: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string;
  type: MessageType;
  mediaUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyToId?: string;
  replyTo?: Message;
  isEdited: boolean;
  isDeleted: boolean;
  status: MessageStatus;
  deliveredAt?: string;
  readAt?: string;
  reactions: Reaction[];
  attachments: Attachment[];
  translations: Translation[];
  /** CORRECTION: { note?: string; acceptedAt?: string } */
  metadata?: { note?: string; acceptedAt?: string } & Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  emoji: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  type: string;
  filename: string;
  size: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number; // for audio/video
  createdAt: string;
}

export interface Translation {
  id: string;
  messageId: string;
  language: string;
  translatedContent: string;
  createdAt: string;
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  readAt: string;
}

export interface ChatSettings {
  id: string;
  chatId: string;
  userId: string;
  isMuted: boolean;
  mutedUntil?: string | null;
  isPinned: boolean;
  notificationSound: string;
  createdAt: string;
  updatedAt: string;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  startedAt: string;
}

// ============ DTOs ============

export interface CreateChatDto {
  type: ChatType;
  name?: string;
  participantIds: string[];
}

export interface SendMessageDto {
  chatId: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyToId?: string;
}

export interface GetMessagesDto {
  chatId: string;
  limit?: number;
  before?: string;
  after?: string;
}

export interface SearchMessagesDto {
  chatId: string;
  query: string;
  limit?: number;
}

export interface MarkReadDto {
  chatId: string;
  messageId: string;
}

export interface AddReactionDto {
  messageId: string;
  emoji: string;
}

export interface UpdateChatSettingsDto {
  isMuted?: boolean;
  mutedUntil?: string | null;
  isPinned?: boolean;
  notificationSound?: string;
}
