import { apiClient } from './client';
import type {
  Chat,
  Message,
  ChatSettings,
  CreateChatDto,
  SendMessageDto,
  GetMessagesDto,
  SearchMessagesDto,
  MarkReadDto,
  AddReactionDto,
  UpdateChatSettingsDto,
} from '@speakbetter/types';

// ============ CHAT API ============

export const chatApi = {
  // ---------- Chats ----------
  getUserChats: () => 
    apiClient.get<Chat[]>('/chat'),

  getChatById: (chatId: string) => 
    apiClient.get<Chat>(`/chat/${chatId}`),

  createPrivateChat: (userId: string) => 
    apiClient.post<Chat>(`/chat/private/${userId}`),

  createGroupChat: (data: { name: string; participantIds: string[] }) => 
    apiClient.post<Chat>('/chat/group', data),

  updateChatName: (chatId: string, name: string) => 
    apiClient.put<Chat>(`/chat/${chatId}/name`, { name }),

  addParticipants: (chatId: string, userIds: string[]) => 
    apiClient.post(`/chat/${chatId}/participants`, { userIds }),

  removeParticipant: (chatId: string, userId: string) => 
    apiClient.delete(`/chat/${chatId}/participants/${userId}`),

  deleteChat: (chatId: string) => 
    apiClient.delete(`/chat/${chatId}`),

  // ---------- Messages ----------
  getMessages: (chatId: string, params?: { limit?: number; before?: string }) => 
    apiClient.get<Message[]>(`/chat/${chatId}/messages`, { params }),

  sendMessage: (data: SendMessageDto) => 
    apiClient.post<Message>('/chat/messages', data),

  editMessage: (messageId: string, content: string) => 
    apiClient.put<Message>(`/chat/messages/${messageId}`, { content }),

  deleteMessage: (messageId: string) => 
    apiClient.delete(`/chat/messages/${messageId}`),

  forwardMessage: (messageId: string, chatId: string) => 
    apiClient.post(`/chat/messages/${messageId}/forward`, { chatId }),

  // ---------- Reactions ----------
  addReaction: (data: AddReactionDto) => 
    apiClient.post('/chat/reactions', data),

  removeReaction: (messageId: string, emoji: string) => 
    apiClient.delete(`/chat/reactions/${messageId}/${emoji}`),

  // ---------- Read Receipts ----------
  markRead: (data: MarkReadDto) => 
    apiClient.put('/chat/messages/read', data),

  getReadReceipts: (messageId: string) => 
    apiClient.get(`/chat/messages/${messageId}/read-receipts`),

  // ---------- Search ----------
  searchMessages: (data: SearchMessagesDto) => 
    apiClient.get<Message[]>(`/chat/${data.chatId}/search`, { 
      params: { q: data.query, limit: data.limit } 
    }),

  // ---------- Settings ----------
  getChatSettings: (chatId: string) => 
    apiClient.get<ChatSettings>(`/chat/${chatId}/settings`),

  updateChatSettings: (chatId: string, data: UpdateChatSettingsDto) => 
    apiClient.put<ChatSettings>(`/chat/${chatId}/settings`, data),

  // ---------- Pinned Messages ----------
  pinMessage: (chatId: string, messageId: string) => 
    apiClient.post(`/chat/${chatId}/pin/${messageId}`),

  unpinMessage: (chatId: string, messageId: string) => 
    apiClient.delete(`/chat/${chatId}/pin/${messageId}`),

  getPinnedMessages: (chatId: string) => 
    apiClient.get<Message[]>(`/chat/${chatId}/pinned`),
};