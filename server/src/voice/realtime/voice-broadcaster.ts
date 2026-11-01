import { userRoom } from './room-access';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { VoiceRoomState } from './voice-room-state';

/**
 * Everything that pushes events to people in voice rooms. The gateways use it
 * for the shared cases, and REST controllers and services use it to tell a
 * room about a change without depending on a gateway.
 */
@Injectable()
export class VoiceBroadcaster {
  private server!: Server;

  constructor(private readonly state: VoiceRoomState) {}

  /** Called once by VoiceGateway when the namespace is ready */
  attach(server: Server) {
    this.server = server;
  }

  /** Sends an event to every open tab/device of one user */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /** Emits a chat event (edit, delete, reaction, pin) to everyone in the room */
  emitToRoom(roomId: string, event: string, payload: unknown) {
    this.server?.to(`voice:${roomId}`).emit(event, payload);
  }

  /** Sends a saved chat message to everyone in the room (also used by the REST fallback) */
  async broadcastChatMessage(roomId: string, message: any, clientId?: string) {
    const isHost = (await this.state.getHost(roomId)) === message.senderId;
    this.server?.to(`voice:${roomId}`).emit('voice:chat', {
      ...message,
      isHost,
      ...(clientId ? { clientId } : {}),
    });
  }

  /** Tells everyone in the room about a role change, including whether that person may now speak */
  broadcastRoleChange(
    roomId: string,
    userId: string,
    role: string,
    canSpeak: boolean,
    by: string,
  ) {
    this.server.to(`voice:${roomId}`).emit('voice:role-changed', {
      userId,
      role,
      canSpeak,
      by,
    });
  }

  broadcastTranscription(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('transcription', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastClap(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('clap-received', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastQueueUpdate(roomId: string, queue: any[]) {
    this.server.to(`voice:${roomId}`).emit('queue-updated', {
      queue,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantUpdate(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('participant-updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantJoined(roomId: string, participant: any) {
    this.server.to(`voice:${roomId}`).emit('participant-joined', {
      participant,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantLeft(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('participant-left', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantMuted(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-muted', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantUnmuted(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-unmuted', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastHandRaised(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('hand-raised', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastHandLowered(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('hand-lowered', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRecordingStarted(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('recording-started', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRecordingStopped(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('recording-stopped', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantKicked(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-kicked', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastMuteAll(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('mute-all', {
      timestamp: new Date().toISOString(),
    });
  }
}
