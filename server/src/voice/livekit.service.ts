// server/src/voice/livekit.service.ts

import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoomServiceClient,
  Room,
  CreateOptions,
  AccessToken,
  DataPacket_Kind,
  TrackSource,
} from 'livekit-server-sdk';

@Injectable()
export class LiveKitService implements OnModuleInit {
  private readonly logger = new Logger(LiveKitService.name);

  private roomService!: RoomServiceClient;

  private isLiveKitAvailable = false;

  private livekitHttpUrl = '';
  private livekitWsUrl = '';
  private livekitHost = '';

  private apiKey = '';
  private apiSecret = '';

  constructor(private readonly configService: ConfigService) {}

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async onModuleInit(): Promise<void> {
    this.loadConfiguration();

    this.logConfiguration();

    if (!this.apiKey || !this.apiSecret) {
      this.logger.error(
        '❌ LiveKit API credentials are missing. ' +
          'Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.',
      );

      this.isLiveKitAvailable = false;
      return;
    }

    try {
      this.roomService = new RoomServiceClient(
        this.livekitHttpUrl,
        this.apiKey,
        this.apiSecret,
      );

      this.logger.log('🔄 Testing LiveKit server connection...');

      const rooms = await Promise.race([
        this.roomService.listRooms(),
        new Promise<Room[]>((_, reject) => {
          setTimeout(() => {
            reject(new Error('LiveKit connection timeout after 5 seconds'));
          }, 5000);
        }),
      ]);

      this.isLiveKitAvailable = true;

      this.logger.log(
        `✅ LiveKit connected successfully. Rooms: ${rooms?.length ?? 0}`,
      );
    } catch (error) {
      this.isLiveKitAvailable = false;

      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ LiveKit connection failed: ${message}`);

      this.logger.error(
        '⚠️ Real-time voice will NOT work until LiveKit is reachable.',
      );

      this.logger.error(
        'Check LIVEKIT_HTTP_URL, LIVEKIT_WS_URL, API credentials, ' +
          'and LiveKit WebRTC ports/firewall configuration.',
      );
    }
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  private loadConfiguration(): void {
    const configuredHttpUrl = this.configService
      .get<string>('LIVEKIT_HTTP_URL')
      ?.trim();

    const configuredWsUrl = this.configService
      .get<string>('LIVEKIT_WS_URL')
      ?.trim();

    const configuredHost = this.configService
      .get<string>('LIVEKIT_HOST')
      ?.trim();

    this.apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY')?.trim() ?? '';

    this.apiSecret =
      this.configService.get<string>('LIVEKIT_API_SECRET')?.trim() ?? '';

    this.livekitHttpUrl =
      configuredHttpUrl ||
      this.configService.get<string>('LIVEKIT_URL')?.trim() ||
      'http://localhost:7880';

    this.livekitWsUrl =
      configuredWsUrl || this.convertHttpToWebSocketUrl(this.livekitHttpUrl);

    this.livekitHost = configuredHost || this.extractHost(this.livekitHttpUrl);
  }

  private convertHttpToWebSocketUrl(url: string): string {
    if (url.startsWith('https://')) {
      return url.replace(/^https:\/\//, 'wss://');
    }

    if (url.startsWith('http://')) {
      return url.replace(/^http:\/\//, 'ws://');
    }

    if (url.startsWith('wss://') || url.startsWith('ws://')) {
      return url;
    }

    return `ws://${url}`;
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  }

  private logConfiguration(): void {
    this.logger.log('🔌 LiveKit configuration:');
    this.logger.log(`   HTTP URL: ${this.livekitHttpUrl}`);
    this.logger.log(`   WebSocket URL: ${this.livekitWsUrl}`);
    this.logger.log(`   Host: ${this.livekitHost}`);

    if (this.apiKey) {
      this.logger.log(`   API Key: ${this.apiKey.substring(0, 8)}...`);
    } else {
      this.logger.log('   API Key: NOT SET');
    }

    this.logger.log(`   API Secret: ${this.apiSecret ? 'SET' : 'NOT SET'}`);
  }

  // ============================================================
  // ROOM MANAGEMENT
  // ============================================================

  async createRoom(roomName: string, options?: CreateOptions): Promise<Room> {
    this.ensureAvailable();

    try {
      const room = await this.roomService.createRoom({
        name: roomName,

        emptyTimeout: 10 * 60,

        departureTimeout: 5 * 60,

        maxParticipants: 50,

        ...options,
      });

      this.logger.log(`✅ LiveKit room created: ${roomName}`);

      return room;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `❌ Failed to create LiveKit room ${roomName}: ${message}`,
      );

      throw new Error(`Failed to create LiveKit room: ${message}`);
    }
  }

  async endRoom(roomName: string): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(
        `⚠️ LiveKit unavailable. Cannot delete room ${roomName}.`,
      );
      return;
    }

    try {
      await this.roomService.deleteRoom(roomName);

      this.logger.log(`✅ LiveKit room deleted: ${roomName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `❌ Failed to delete LiveKit room ${roomName}: ${message}`,
      );

      throw new Error(`Failed to delete LiveKit room: ${message}`);
    }
  }

  async listRooms(): Promise<Room[]> {
    if (!this.isLiveKitAvailable) {
      return [];
    }

    try {
      return await this.roomService.listRooms();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to list LiveKit rooms: ${message}`);

      return [];
    }
  }

  async getRoom(roomName: string): Promise<Room | null> {
    if (!this.isLiveKitAvailable) {
      return null;
    }

    try {
      const rooms = await this.roomService.listRooms();

      return rooms.find((room) => room.name === roomName) ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `❌ Failed to get LiveKit room ${roomName}: ${message}`,
      );

      return null;
    }
  }

  // ============================================================
  // TOKEN GENERATION
  // ============================================================

  async generateToken(
    roomName: string,
    userId: string,
    identity?: string,
    options: { canPublish?: boolean } = {},
  ): Promise<string> {
    this.ensureAvailable();

    if (!roomName?.trim()) {
      throw new Error('LiveKit room name is required');
    }

    if (!userId?.trim()) {
      throw new Error('User ID is required for LiveKit token');
    }

    const participantIdentity = identity?.trim() || userId.trim();

    try {
      // ✅ Log token generation attempt
      this.logger.log(
        `🔑 Generating token for room=${roomName}, user=${userId}`,
      );

      const token = new AccessToken(this.apiKey, this.apiSecret, {
        identity: participantIdentity,
        name: userId,
        ttl: '6h',
        metadata: JSON.stringify({
          userId,
          roomName,
        }),
      });

      // Audience members in stage rooms join listen-only; promotion grants publish later
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: options.canPublish ?? true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
        canPublishSources: [TrackSource.MICROPHONE],
      });

      const jwt = await token.toJwt();

      // ✅ Validate token
      if (!jwt || jwt.split('.').length !== 3) {
        this.logger.error(
          `❌ Invalid token format: ${jwt?.split('.').length || 0} parts`,
        );
        throw new Error('LiveKit returned an invalid JWT token');
      }

      // ✅ Log token preview
      this.logger.log(
        `✅ Token generated | room=${roomName} | identity=${participantIdentity} | token=${jwt.substring(0, 30)}...`,
      );

      return jwt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to generate LiveKit token: ${message}`);
      throw new Error(`Failed to generate LiveKit token: ${message}`);
    }
  }

  async getParticipantToken(
    roomName: string,
    userId: string,
    identity?: string,
    options: { canPublish?: boolean } = {},
  ): Promise<string> {
    return this.generateToken(roomName, userId, identity, options);
  }

  /**
   * Grants or revokes microphone publishing for a connected participant.
   * Revoking makes LiveKit unpublish their mic immediately.
   */
  async setCanPublish(
    roomName: string,
    identity: string,
    canPublish: boolean,
  ): Promise<void> {
    if (!this.isLiveKitAvailable) return;

    try {
      await this.roomService.updateParticipant(roomName, identity, {
        permission: {
          canPublish,
          canSubscribe: true,
          canPublishData: true,
          canUpdateMetadata: true,
          canPublishSources: [TrackSource.MICROPHONE],
        },
      });
      this.logger.log(
        `🎚️ Publish ${canPublish ? 'granted' : 'revoked'} | room=${roomName} | participant=${identity}`,
      );
    } catch (error) {
      // Not connected to LiveKit yet: their next token will carry the right grant
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `⚠️ Could not update publish permission for ${identity}: ${message}`,
      );
    }
  }

  private async getMicrophoneTrackSid(
    roomName: string,
    identity: string,
  ): Promise<string | null> {
    const participant = await this.roomService.getParticipant(
      roomName,
      identity,
    );
    const track = participant?.tracks?.find(
      (t: any) => t.source === TrackSource.MICROPHONE,
    );
    return track?.sid ?? null;
  }

  // ============================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================

  async getParticipants(roomName: string): Promise<any[]> {
    if (!this.isLiveKitAvailable) {
      return [];
    }

    try {
      return await this.roomService.listParticipants(roomName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `❌ Failed to get participants from ${roomName}: ${message}`,
      );

      return [];
    }
  }

  async getParticipant(
    roomName: string,
    participantId: string,
  ): Promise<any | null> {
    if (!this.isLiveKitAvailable) {
      return null;
    }

    try {
      return await this.roomService.getParticipant(roomName, participantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `❌ Failed to get participant ${participantId}: ${message}`,
      );

      return null;
    }
  }

  async getActiveParticipants(roomName: string): Promise<any[]> {
    if (!this.isLiveKitAvailable) {
      return [];
    }

    try {
      const participants = await this.roomService.listParticipants(roomName);

      return participants.filter(
        (participant: any) => participant.state === 'ACTIVE',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to get active participants: ${message}`);

      return [];
    }
  }

  async muteParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    this.ensureAvailable();

    try {
      const trackSid = await this.getMicrophoneTrackSid(roomName, participantId);
      if (!trackSid) {
        this.logger.log(
          `🔇 No microphone published by ${participantId}; nothing to mute`,
        );
        return;
      }

      await this.roomService.mutePublishedTrack(
        roomName,
        participantId,
        trackSid,
        true,
      );

      this.logger.log(
        `🔇 Participant muted | room=${roomName} | participant=${participantId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to mute participant: ${message}`);

      throw new Error(`Failed to mute participant: ${message}`);
    }
  }

  async unmuteParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    this.ensureAvailable();

    try {
      // Note: LiveKit only allows remote unmute when enable_remote_unmute is on
      const trackSid = await this.getMicrophoneTrackSid(roomName, participantId);
      if (!trackSid) return;

      await this.roomService.mutePublishedTrack(
        roomName,
        participantId,
        trackSid,
        false,
      );

      this.logger.log(
        `🎙️ Participant unmuted | room=${roomName} | participant=${participantId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to unmute participant: ${message}`);

      throw new Error(`Failed to unmute participant: ${message}`);
    }
  }

  async removeParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    this.ensureAvailable();

    try {
      await this.roomService.removeParticipant(roomName, participantId);

      this.logger.log(
        `🚪 Participant removed | room=${roomName} | participant=${participantId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to remove participant: ${message}`);

      throw new Error(`Failed to remove participant: ${message}`);
    }
  }

  // ============================================================
  // DATA MESSAGES
  // ============================================================

  async sendData(roomName: string, data: any, options?: any): Promise<void> {
    this.ensureAvailable();

    try {
      const payload = Buffer.from(JSON.stringify(data));

      await this.roomService.sendData(
        roomName,
        payload,
        DataPacket_Kind.RELIABLE,
        options,
      );

      this.logger.log(`📡 LiveKit data sent to ${roomName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to send LiveKit data: ${message}`);

      throw new Error(`Failed to send LiveKit data: ${message}`);
    }
  }

  // ============================================================
  // RECORDING
  // ============================================================

  async startRecording(roomName: string): Promise<any> {
    this.ensureAvailable();

    this.logger.warn(
      `⚠️ startRecording() called for ${roomName}, ` +
        `but Egress implementation is not configured yet.`,
    );

    return {
      success: false,
      roomName,
      message: 'LiveKit Egress recording is not configured.',
    };
  }

  async stopRecording(roomName: string): Promise<void> {
    this.ensureAvailable();

    this.logger.warn(
      `⚠️ stopRecording() called for ${roomName}, ` +
        `but Egress implementation is not configured yet.`,
    );
  }

  async startEgress(roomName: string, options: any): Promise<any> {
    this.ensureAvailable();

    this.logger.warn(
      `⚠️ startEgress() called for ${roomName}. ` +
        `Egress implementation is not configured yet.`,
    );

    return {
      success: false,
      roomName,
      options,
      message: 'LiveKit Egress is not configured yet.',
    };
  }

  // ============================================================
  // ROOM METADATA
  // ============================================================

  async updateRoomMetadata(roomName: string, metadata: any): Promise<void> {
    this.ensureAvailable();

    try {
      await this.roomService.updateRoomMetadata(
        roomName,
        JSON.stringify(metadata),
      );

      this.logger.log(`✅ LiveKit metadata updated: ${roomName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to update room metadata: ${message}`);

      throw new Error(`Failed to update room metadata: ${message}`);
    }
  }

  // ============================================================
  // ROOM INFORMATION
  // ============================================================

  async getRoomInfo(roomName: string): Promise<any> {
    if (!this.isLiveKitAvailable) {
      return {
        room: null,
        participants: [],
        participantCount: 0,
        available: false,
      };
    }

    try {
      const [room, participants] = await Promise.all([
        this.getRoom(roomName),
        this.getParticipants(roomName),
      ]);

      return {
        room,
        participants,
        participantCount: participants.length,
        available: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Failed to get room info: ${message}`);

      return {
        room: null,
        participants: [],
        participantCount: 0,
        available: false,
      };
    }
  }

  // ============================================================
  // STATUS / CONNECTION
  // ============================================================

  isAvailable(): boolean {
    return this.isLiveKitAvailable;
  }

  getWebSocketUrl(): string {
    return this.livekitWsUrl;
  }

  getHttpUrl(): string {
    return this.livekitHttpUrl;
  }

  getHost(): string {
    return this.livekitHost;
  }

  getStatus(): {
    available: boolean;
    host: string;
    httpUrl: string;
    wsUrl: string;
    apiKey: string;
  } {
    return {
      available: this.isLiveKitAvailable,
      host: this.livekitHost,
      httpUrl: this.livekitHttpUrl,
      wsUrl: this.livekitWsUrl,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'not set',
    };
  }

  // ============================================================
  // WEBHOOK
  // ============================================================

  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(`📨 LiveKit webhook event: ${event?.event}`);

    switch (event?.event) {
      case 'room_started':
        this.logger.log(`🏠 Room started: ${event.room?.name ?? 'unknown'}`);
        break;

      case 'room_finished':
        this.logger.log(`🏁 Room finished: ${event.room?.name ?? 'unknown'}`);
        break;

      case 'participant_joined':
        this.logger.log(
          `👤 Participant joined: ${
            event.participant?.identity ?? 'unknown'
          } in ${event.room?.name ?? 'unknown'}`,
        );
        break;

      case 'participant_left':
        this.logger.log(
          `👋 Participant left: ${
            event.participant?.identity ?? 'unknown'
          } from ${event.room?.name ?? 'unknown'}`,
        );
        break;

      case 'track_published':
        this.logger.log(`🎤 Track published: ${event.track?.sid ?? 'unknown'}`);
        break;

      case 'track_subscribed':
        this.logger.log(
          `🔊 Track subscribed: ${event.track?.sid ?? 'unknown'}`,
        );
        break;

      case 'track_unsubscribed':
        this.logger.log(
          `🔇 Track unsubscribed: ${event.track?.sid ?? 'unknown'}`,
        );
        break;

      default:
        this.logger.log(`ℹ️ Unhandled LiveKit event: ${event?.event}`);
    }
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  private ensureAvailable(): void {
    if (!this.isLiveKitAvailable) {
      throw new ServiceUnavailableException(
        'LiveKit server is unavailable. ' +
          'Check LiveKit configuration and server connectivity.',
      );
    }
  }
}
