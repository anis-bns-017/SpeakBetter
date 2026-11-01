
import { apiClient } from '../lib/api/client';

export const voiceApi = {
  // Room Management
  createRoom: (data: any) => apiClient.post('/voice/rooms', data),
  getRoom: (roomId: string) => apiClient.get(`/voice/rooms/${roomId}`),
  joinRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/join`),
  leaveRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/leave`),
  getTrendingRooms: (limit?: number) => apiClient.get('/voice/rooms/trending', { params: { limit } }),
  getRoomsByCategory: (category: string, limit?: number) => 
    apiClient.get(`/voice/rooms/category/${category}`, { params: { limit } }),
  getRoomsByLanguage: (language: string, limit?: number) => 
    apiClient.get(`/voice/rooms/language/${language}`, { params: { limit } }),
  getPopularCategories: () => apiClient.get('/voice/rooms/popular-categories'),

  // Bans (host / moderator)
  getBans: (roomId: string) => apiClient.get(`/voice/rooms/${roomId}/bans`),
  unban: (roomId: string, userId: string) =>
    apiClient.delete(`/voice/rooms/${roomId}/bans/${userId}`),

  // Transcription
  startTranscription: (roomId: string) => apiClient.post(`/voice/transcription/start/${roomId}`),
  stopTranscription: (roomId: string) => apiClient.post(`/voice/transcription/stop/${roomId}`),
  getTranscriptions: (roomId: string, limit?: number) => 
    apiClient.get(`/voice/transcription/${roomId}`, { params: { limit } }),
  translateTranscription: (transcriptionId: string, targetLanguage: string) =>
    apiClient.post(`/voice/transcription/translate/${transcriptionId}`, { targetLanguage }),
  getTranslatedTranscriptions: (roomId: string, targetLanguage: string) =>
    apiClient.get(`/voice/transcription/translate/${roomId}/${targetLanguage}`),

  // Claps
  addClap: (roomId: string, targetUserId?: string) =>
    apiClient.post(`/voice/claps/${roomId}`, { targetUserId }),
  getClapStats: (roomId: string) => apiClient.get(`/voice/claps/${roomId}/stats`),

  // Queue
  addToQueue: (roomId: string) => apiClient.post(`/voice/queue/${roomId}`),
  removeFromQueue: (roomId: string) => apiClient.delete(`/voice/queue/${roomId}`),
  getQueue: (roomId: string) => apiClient.get(`/voice/queue/${roomId}`),
  promoteToSpeaker: (roomId: string, userId: string) => 
    apiClient.post(`/voice/queue/promote/${roomId}/${userId}`),
  inviteToStage: (roomId: string, userId: string) => 
    apiClient.post(`/voice/queue/invite/${roomId}/${userId}`),

  // Invites
  generateInvite: (roomId: string, data: { maxUses?: number; expiresInHours?: number }) =>
    apiClient.post(`/voice/invites/${roomId}`, data),
  validateInvite: (code: string) => apiClient.get(`/voice/invites/validate/${code}`),
  useInvite: (code: string) => apiClient.post(`/voice/invites/use/${code}`),
  deleteInvite: (inviteId: string) => apiClient.delete(`/voice/invites/${inviteId}`),

  // Analytics
  getRoomAnalytics: (roomId: string) => apiClient.get(`/voice/analytics/${roomId}`),
  getSpeakerStats: (roomId: string) => apiClient.get(`/voice/analytics/${roomId}/speakers`),
  getLiveStats: (roomId: string) => apiClient.get(`/voice/analytics/${roomId}/live`),

  // Recording
  startRecording: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/recording/start`),
  stopRecording: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/recording/stop`),

  // Controls
  muteParticipant: (roomId: string, userId: string) => 
    apiClient.post(`/voice/rooms/${roomId}/mute/${userId}`),
  unmuteParticipant: (roomId: string, userId: string) => 
    apiClient.post(`/voice/rooms/${roomId}/unmute/${userId}`),
  muteAll: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/mute-all`),
  kickParticipant: (roomId: string, userId: string) => 
    apiClient.post(`/voice/rooms/${roomId}/kick/${userId}`),
  raiseHand: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/raise-hand`),
  lowerHand: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/lower-hand`),
};