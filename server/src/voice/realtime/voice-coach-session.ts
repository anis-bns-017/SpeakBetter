import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CoachService } from '../coach/coach.service';
import { VoiceService } from '../voice.service';
import { VoiceBroadcaster } from './voice-broadcaster';
import { VoiceRoomState } from './voice-room-state';

/**
 * The live side of the room coach: speaking turns, airtime bars and the
 * per-person coach report. Used by the core gateway (join / leave) and the
 * coach gateway (speaking, captions).
 */
@Injectable()
export class VoiceCoachSession implements OnModuleInit {
  private readonly logger = new Logger(VoiceCoachSession.name);

  constructor(
    private readonly coach: CoachService,
    private readonly voiceService: VoiceService,
    private readonly state: VoiceRoomState,
    private readonly broadcaster: VoiceBroadcaster,
  ) {}

  onModuleInit() {
    // A mission round that runs out of time is announced to the room from here
    this.coach.onMissionEnd((roomId, result) => {
      this.broadcaster.emitToRoom(roomId, 'voice:mission-ended', result);
    });
  }

  /** Pushes the room's airtime bars, at most once every couple of seconds */
  scheduleAirtime(roomId: string) {
    if (this.state.airtimeTimers.has(roomId)) return;
    this.state.airtimeTimers.set(
      roomId,
      setTimeout(() => {
        this.state.airtimeTimers.delete(roomId);
        void this.coach
          .airtime(roomId)
          .then((airtime) =>
            this.broadcaster.emitToRoom(roomId, 'voice:airtime', airtime),
          )
          .catch((error) =>
            this.logger.warn(`Could not build airtime: ${error?.message}`),
          );
      }, 2000),
    );
  }

  /** Saves the person's coach report; frees the room's coach state once nobody is left */
  async finishCoachSession(roomId: string, userId: string) {
    try {
      await this.coach.leave(roomId, userId);
      if (!(await this.state.hasRoom(roomId))) {
        await this.coach.closeRoom(roomId);
        const timer = this.state.airtimeTimers.get(roomId);
        if (timer) clearTimeout(timer);
        this.state.airtimeTimers.delete(roomId);
      }
    } catch (error) {
      this.logger.warn(
        `Coach session end failed for ${userId} in ${roomId}: ${error?.message}`,
      );
    }
  }

  /** Ends an open speaking turn and records its length */
  flushSpeaking(roomId: string, userId: string) {
    const key = `${roomId}:${userId}`;
    const since = this.state.speakingSince.get(key);
    if (since === undefined) return;
    this.state.speakingSince.delete(key);
    // The client reports "stopped" after ~1.5s of silence; don't count that tail
    const seconds = Math.min(600, (Date.now() - since) / 1000 - 1.5);
    if (seconds >= 1) {
      this.coach.noteSpeaking(roomId, userId, seconds);
      this.scheduleAirtime(roomId);
      void this.voiceService
        .recordSpeakingTime(roomId, userId, Math.round(seconds))
        .catch((error) =>
          this.logger.warn(`Could not record speaking time: ${error?.message}`),
        );
    }
  }

  /** Everything one person needs to draw the coach panel */
  async buildCoachState(roomId: string, userId: string) {
    return {
      coach: this.coach.getLive(roomId, userId),
      mission: this.coach.missionPublic(roomId),
      myMission: this.coach.missionPrivate(roomId, userId),
      airtime: await this.coach.airtime(roomId),
    };
  }
}
