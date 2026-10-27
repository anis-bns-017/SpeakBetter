
import { useState, useEffect, useCallback } from 'react';
import { voiceApi } from './voiceApi';
import { useSocket } from './useSocket';

export interface Transcription {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  confidence?: number;
  timestamp: Date;
}

export const useTranscription = (roomId: string) => {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const { socket, isConnected } = useSocket();

  // Load existing transcriptions
  useEffect(() => {
    const loadTranscriptions = async () => {
      try {
        const response = await voiceApi.getTranscriptions(roomId, 50);
        setTranscriptions(response.data.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })));
      } catch (error) {
        console.error('Failed to load transcriptions:', error);
      }
    };
    loadTranscriptions();
  }, [roomId]);

  // Listen for new transcriptions via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTranscription = (data: any) => {
      const newTranscription: Transcription = {
        id: data.id || `temp-${Date.now()}`,
        text: data.text,
        isFinal: data.isFinal || false,
        speaker: data.speaker || 'unknown',
        userId: data.userId,
        user: data.user,
        confidence: data.confidence,
        timestamp: new Date(data.timestamp || Date.now()),
      };

      setTranscriptions(prev => {
        // If it's a final transcription, replace any interim version
        if (newTranscription.isFinal) {
          return [...prev.filter(t => !t.isFinal), newTranscription];
        }
        // For interim, update the latest interim or add new
        const existingInterim = prev.find(t => !t.isFinal);
        if (existingInterim) {
          return prev.map(t =>
            t.id === existingInterim.id ? newTranscription : t
          );
        }
        return [...prev, newTranscription];
      });
    };

    socket.on('transcription', handleTranscription);

    return () => {
      socket.off('transcription', handleTranscription);
    };
  }, [socket, isConnected]);

  const startTranscription = useCallback(async () => {
    try {
      await voiceApi.startTranscription(roomId);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  }, [roomId]);

  const stopTranscription = useCallback(async () => {
    try {
      await voiceApi.stopTranscription(roomId);
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop transcription:', error);
    }
  }, [roomId]);

  const translateTranscription = useCallback(async (transcriptionId: string, targetLanguage: string) => {
    setIsTranslating(true);
    try {
      const response = await voiceApi.translateTranscription(transcriptionId, targetLanguage);
      // Update the transcription with translation
      setTranscriptions(prev =>
        prev.map(t =>
          t.id === transcriptionId
            ? { ...t, translated: { text: response.data.translatedText, language: targetLanguage } }
            : t
        )
      );
      return response.data;
    } catch (error) {
      console.error('Failed to translate transcription:', error);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return {
    transcriptions,
    isRecording,
    isTranslating,
    startTranscription,
    stopTranscription,
    translateTranscription,
  };
};