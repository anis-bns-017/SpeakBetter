// server/src/voice/realtime/voice-coach.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { VoiceService } from '../voice.service';
import { CoachService } from '../coach/coach.service';
import { VoiceRoomState } from './voice-room-state';
import { VoiceBroadcaster } from './voice-broadcaster';
import { VoiceCoachSession } from './voice-coach-session';
import { isSocketInRoom } from './room-access';
import { VOICE_GATEWAY_OPTIONS } from './gateway-options';

/**
 * Speaking turns, live captions and the room coach: missions, spotlight, corrections.
 */
@WebSocketGateway(VOICE_GATEWAY_OPTIONS)
export class VoiceCoachGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceCoachGateway.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly coach: CoachService,
    private readonly state: VoiceRoomState,
    private readonly broadcaster: VoiceBroadcaster,
    private readonly coachSession: VoiceCoachSession,
  ) {}

  @SubscribeMessage('voice:speaking')
  async handleSpeaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isSpeaking: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId || !isSocketInRoom(client, data?.roomId)) return;

    const roomName = `voice:${data.roomId}`;
    this.server.to(roomName).emit('voice:speaking-status', {
      userId,
      isSpeaking: data.isSpeaking,
    });

    // Measure each speaking turn; it feeds speaker stats, XP and the streak
    const key = `${data.roomId}:${userId}`;
    if (data.isSpeaking) {
      if (!this.state.speakingSince.has(key))
        this.state.speakingSince.set(key, Date.now());
    } else {
      this.coachSession.flushSpeaking(data.roomId, userId);
    }
  }

  @SubscribeMessage('voice:transcription')
  async handleTranscription(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      id?: string;
      text: string;
      isFinal: boolean;
      confidence?: number;
      language?: string;
    },
  ) {
    if (!data?.roomId || !data?.text) return;

    const userId = (client.data as any)?.userId;
    const userName = (client.data as any)?.userName;
    if (!userId || !isSocketInRoom(client, data.roomId)) return;

    // Sanity cap — prevent huge strings
    const text = String(data.text).slice(0, 500);

    // Broadcast to everyone in the room (including the sender is fine,
    // the client ignores its own echo)
    const id = data.id || `${userId}-${Date.now()}`;
    this.server.to(`voice:${data.roomId}`).emit('voice:transcription', {
      id,
      userId,
      userName,
      text,
      isFinal: Boolean(data.isFinal),
      confidence: Number(data.confidence ?? 0),
      language: data.language,
      createdAt: Date.now(),
    });

    // Coach: only finished lines from people who are really in the room count
    if (
      !data.isFinal ||
      !(await this.state.isInRoom(data.roomId, userId))
    )
      return;
    try {
      const { live, completion } = await this.coach.onFinalUtterance(
        data.roomId,
        userId,
        text,
        id,
      );
      if (live) this.broadcaster.emitToUser(userId, 'voice:coach', live);
      if (completion) {
        const roomName = `voice:${data.roomId}`;
        this.server.to(roomName).emit('voice:mission-complete', completion);
        this.server
          .to(roomName)
          .emit(
            'voice:mission-progress',
            this.coach.missionPublic(data.roomId),
          );
        this.broadcaster.emitToUser(
          userId,
          'voice:mission-word',
          this.coach.missionPrivate(data.roomId, userId),
        );
      }
    } catch (error) {
      this.logger.warn(`Coach could not process a caption: ${error?.message}`);
    }
  }

  @SubscribeMessage('voice:coach-get')
  async handleCoachGet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (
      !userId ||
      !data?.roomId ||
      !(await this.state.isInRoom(data.roomId, userId))
    )
      return;
    try {
      client.emit(
        'voice:coach-state',
        await this.coachSession.buildCoachState(data.roomId, userId),
      );
    } catch (error) {
      this.logger.warn(`Could not send coach state: ${error?.message}`);
    }
  }

  /** Host/moderator starts a round: everyone in the room gets a private secret word */
  @SubscribeMessage('voice:mission-start')
  async handleMissionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; level?: string; durationSec?: number },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId) return;
    try {
      if (!(await this.voiceService.isRoomManager(data.roomId, actorId))) {
        client.emit('voice:error', {
          message: 'Only the host or a moderator can start a mission round',
        });
        return;
      }
      const inRoom = new Set(await this.state.participantIds(data.roomId));
      const people = (await this.coach.airtimePeople(data.roomId)).filter((p) =>
        inRoom.has(p.userId),
      );
      const mission = this.coach.startMission(
        data.roomId,
        {
          level: data.level,
          durationSec: data.durationSec,
          startedBy: actorId,
        },
        people,
      );
      this.server
        .to(`voice:${data.roomId}`)
        .emit('voice:mission-started', mission);
      for (const p of people) {
        this.broadcaster.emitToUser(
          p.userId,
          'voice:mission-word',
          this.coach.missionPrivate(data.roomId, p.userId),
        );
      }
    } catch (error) {
      client.emit('voice:error', {
        message: error?.message || 'Could not start the mission round',
      });
    }
  }

  @SubscribeMessage('voice:mission-stop')
  async handleMissionStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId) return;
    try {
      if (!(await this.voiceService.isRoomManager(data.roomId, actorId))) {
        client.emit('voice:error', {
          message: 'Only the host or a moderator can end a mission round',
        });
        return;
      }
      const result = this.coach.stopMission(data.roomId, 'stopped');
      if (result)
        this.server
          .to(`voice:${data.roomId}`)
          .emit('voice:mission-ended', result);
    } catch (error) {
      client.emit('voice:error', {
        message: error?.message || 'Could not end the mission round',
      });
    }
  }

  @SubscribeMessage('voice:mission-swap')
  async handleMissionSwap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (
      !userId ||
      !data?.roomId ||
      !(await this.state.isInRoom(data.roomId, userId))
    )
      return;
    try {
      this.broadcaster.emitToUser(
        userId,
        'voice:mission-word',
        this.coach.swapWord(data.roomId, userId),
      );
    } catch (error) {
      client.emit('voice:error', {
        message: error?.message || 'Could not swap your word',
      });
    }
  }

  /** Host/moderator puts a topic card in front of the room, aimed at one person (default: whoever has spoken least) */
  @SubscribeMessage('voice:spotlight')
  async handleSpotlight(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      targetUserId?: string;
      cardId?: string;
      level?: string;
      category?: string;
      everyone?: boolean;
    },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId) return;
    try {
      if (!(await this.voiceService.isRoomManager(data.roomId, actorId))) {
        client.emit('voice:error', {
          message: 'Only the host or a moderator can spotlight someone',
        });
        return;
      }
      const { target, card } = await this.coach.spotlight(data.roomId, {
        targetUserId: data.targetUserId,
        cardId: data.cardId,
        level: data.level,
        category: data.category as any,
      });
      this.server.to(`voice:${data.roomId}`).emit('voice:spotlight', {
        id: `spot-${Date.now()}`,
        // "everyone" pushes the card to the whole room instead of one person
        target: data.everyone ? null : target,
        card,
        by: actorId,
        at: Date.now(),
      });
    } catch (error) {
      client.emit('voice:error', {
        message: error?.message || 'Could not spotlight',
      });
    }
  }

  @SubscribeMessage('voice:correction')
  async handleCorrection(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      id: string;
      targetUserId: string;
      targetUserName: string;
      original: string;
      corrected: string;
      note?: string;
      category: string;
    },
  ) {
    const authorId = (client.data as any)?.userId;
    if (!authorId || !data?.roomId || !data?.targetUserId) return;

    try {
      // Saved first, so it survives refreshes and late joiners see it
      const payload = await this.voiceService.createCorrection(authorId, data);
      this.server.to(`voice:${data.roomId}`).emit('voice:correction', payload);
    } catch (error) {
      this.logger.warn(`Correction rejected: ${error?.message}`);
      client.emit('voice:correction-failed', {
        id: data.id,
        message: error?.message || 'Could not send correction',
      });
    }
  }

  @SubscribeMessage('voice:correction-resolve')
  async handleCorrectionResolve(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; id: string; status: 'accepted' | 'dismissed' },
  ) {
    const userId = (client.data as any)?.userId;
    if (!userId || !data?.roomId || !data?.id) return;

    try {
      const updated = await this.voiceService.resolveCorrection(
        userId,
        data.roomId,
        data.id,
        data.status,
      );
      this.server.to(`voice:${data.roomId}`).emit('voice:correction-status', {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt,
      });
    } catch (error) {
      client.emit('voice:error', {
        message: error?.message || 'Could not update correction',
      });
    }
  }
}
