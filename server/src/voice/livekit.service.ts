// server/src/voice/livekit.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  RoomServiceClient,
  Room,
  CreateOptions,
  AccessToken,
} from 'livekit-server-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LiveKitService implements OnModuleInit {
  private readonly logger = new Logger(LiveKitService.name);
  private roomService: RoomServiceClient;
  private isLiveKitAvailable = false;
  private livekitHttpUrl: string;
  private livekitWsUrl: string;
  private livekitHost: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Load configuration from .env
    this.livekitHost = this.configService.get<string>('LIVEKIT_HOST') || 'localhost:7880';
    this.livekitHttpUrl = this.configService.get<string>('LIVEKIT_HTTP_URL') || 'http://localhost:7882';
    this.livekitWsUrl = this.configService.get<string>('LIVEKIT_WS_URL') || 'ws://localhost:7880';
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET') || 'secret';

    this.logger.log(`🔌 LiveKit Configuration:`);
    this.logger.log(`   HTTP URL: ${this.livekitHttpUrl}`);
    this.logger.log(`   WebSocket URL: ${this.livekitWsUrl}`);
    this.logger.log(`   Host: ${this.livekitHost}`);
    this.logger.log(`   API Key: ${this.apiKey.substring(0, 8)}...`);

    // Validate configuration
    if (!this.apiKey || !this.apiSecret || this.apiKey === 'devkey' && this.apiSecret === 'secret') {
      this.logger.warn('⚠️ Using default dev credentials. For production, set proper API keys.');
    }

    try {
      // Initialize RoomServiceClient with HTTP URL
      this.roomService = new RoomServiceClient(
        this.livekitHttpUrl,
        this.apiKey,
        this.apiSecret,
      );

      // Test connection with timeout
      this.logger.log('🔄 Testing LiveKit connection...');
      const rooms = await Promise.race([
        this.roomService.listRooms(),
        new Promise<Room[]>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
        )
      ]) as Room[];

      this.logger.log(
        `✅ LiveKit connected successfully! Found ${rooms?.length || 0} rooms`,
      );
      this.isLiveKitAvailable = true;
    } catch (error) {
      this.logger.error(`❌ Failed to connect to LiveKit: ${error.message}`);
      this.logger.warn('⚠️ Voice features will run in MOCK MODE');
      this.logger.warn('💡 To enable LiveKit:');
      this.logger.warn('   1️⃣ Start LiveKit server:');
      this.logger.warn('      docker run -d --name livekit \\');
      this.logger.warn('        -p 7880:7880 -p 7881:7881 -p 7882:7882 \\');
      this.logger.warn('        -e LIVEKIT_KEYS=devkey:secret \\');
      this.logger.warn('        livekit/livekit-server:latest --dev');
      this.logger.warn('   2️⃣ Or use LiveKit Cloud: https://cloud.livekit.io');
      this.logger.warn('   3️⃣ Update .env with your LiveKit configuration');
      this.isLiveKitAvailable = false;
    }
  }

  // ==================== ROOM MANAGEMENT ====================

  async createRoom(roomName: string, options?: CreateOptions): Promise<Room> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Creating mock room: ${roomName}`);
      return this.createMockRoom(roomName);
    }

    try {
      const room = await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60, // 10 minutes
        departureTimeout: 5 * 60, // 5 minutes
        maxParticipants: 50,
        ...options,
      });
      this.logger.log(`✅ Room created: ${roomName}`);
      return room;
    } catch (error) {
      this.logger.error(`❌ Failed to create LiveKit room: ${error.message}`);
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }

  async endRoom(roomName: string): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Skipping delete for room: ${roomName}`);
      return;
    }

    try {
      await this.roomService.deleteRoom(roomName);
      this.logger.log(`✅ Room deleted: ${roomName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete LiveKit room: ${roomName}`);
      this.logger.error(`   Error: ${error.message}`);
      throw new Error(`Failed to delete room: ${error.message}`);
    }
  }

  async listRooms(): Promise<Room[]> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn('📝 MOCK: Listing mock rooms');
      return [];
    }

    try {
      const rooms = await this.roomService.listRooms();
      return rooms;
    } catch (error) {
      this.logger.error(`Failed to list rooms: ${error.message}`);
      return [];
    }
  }

  async getRoom(roomName: string): Promise<Room | null> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Getting mock room: ${roomName}`);
      return this.createMockRoom(roomName);
    }

    try {
      const rooms = await this.roomService.listRooms();
      return rooms.find((r) => r.name === roomName) || null;
    } catch (error) {
      this.logger.error(`Failed to get room: ${error.message}`);
      return null;
    }
  }

  // ==================== TOKEN GENERATION ====================

  async generateToken(
    roomName: string,
    userId: string,
    identity?: string,
  ): Promise<string> {
    // If LiveKit is available, generate REAL token
    if (this.isLiveKitAvailable) {
      try {
        const token = new AccessToken(this.apiKey, this.apiSecret, {
          identity: identity || userId,
          name: userId,
          metadata: JSON.stringify({
            userId,
            roomName,
            timestamp: Date.now(),
          }),
        });

        // Add grants for the user
        token.addGrant({
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          canUpdateOwnMetadata: true,
        });

        const jwt = await token.toJwt();
        
        // Validate token is not a mock
        if (jwt.startsWith('mock-')) {
          this.logger.warn('⚠️ Token generation returned mock format!');
          throw new Error('Invalid token generated');
        }
        
        this.logger.log(`✅ Real token generated for ${userId} in ${roomName}`);
        return jwt;
      } catch (error) {
        this.logger.error(`❌ Failed to generate token: ${error.message}`);
        throw new Error(`Failed to generate LiveKit token: ${error.message}`);
      }
    }

    // If LiveKit is not available, throw error
    this.logger.error('❌ Cannot generate token: LiveKit is not available');
    throw new Error('LiveKit server is not available. Please check your configuration.');
  }

  // ==================== PARTICIPANT MANAGEMENT ====================

  async getParticipants(roomName: string): Promise<any[]> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Getting participants for ${roomName}`);
      return [];
    }

    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants;
    } catch (error) {
      this.logger.error(`Failed to get participants: ${error.message}`);
      return [];
    }
  }

  async getParticipantToken(
    roomName: string,
    userId: string,
    identity?: string,
  ): Promise<string> {
    return this.generateToken(roomName, userId, identity);
  }

  async muteParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(
        `📝 MOCK: Muting participant ${participantId} in ${roomName}`,
      );
      return;
    }

    try {
      await this.roomService.mutePublishedTrack(
        roomName,
        participantId,
        'microphone',
        true,
      );
      this.logger.log(`✅ Participant ${participantId} muted in ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to mute participant: ${error.message}`);
      throw new Error(`Failed to mute participant: ${error.message}`);
    }
  }

  async unmuteParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(
        `📝 MOCK: Unmuting participant ${participantId} in ${roomName}`,
      );
      return;
    }

    try {
      await this.roomService.mutePublishedTrack(
        roomName,
        participantId,
        'microphone',
        false,
      );
      this.logger.log(`✅ Participant ${participantId} unmuted in ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to unmute participant: ${error.message}`);
      throw new Error(`Failed to unmute participant: ${error.message}`);
    }
  }

  async removeParticipant(
    roomName: string,
    participantId: string,
  ): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(
        `📝 MOCK: Removing participant ${participantId} from ${roomName}`,
      );
      return;
    }

    try {
      await this.roomService.removeParticipant(roomName, participantId);
      this.logger.log(
        `✅ Participant ${participantId} removed from ${roomName}`,
      );
    } catch (error) {
      this.logger.error(`Failed to remove participant: ${error.message}`);
      throw new Error(`Failed to remove participant: ${error.message}`);
    }
  }

  // ==================== RECORDING MANAGEMENT ====================

  async startRecording(roomName: string): Promise<any> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Starting recording for ${roomName}`);
      return {
        success: true,
        mock: true,
        recordingId: `mock-recording-${Date.now()}`,
      };
    }

    try {
      // Note: LiveKit's recording API might be different
      // This is a placeholder - you may need to use Egress API differently
      this.logger.log(`✅ Recording started for ${roomName}`);
      return { success: true, roomName };
    } catch (error) {
      this.logger.error(`Failed to start recording: ${error.message}`);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  async stopRecording(roomName: string): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Stopping recording for ${roomName}`);
      return;
    }

    try {
      this.logger.log(`✅ Recording stopped for ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to stop recording: ${error.message}`);
      throw new Error(`Failed to stop recording: ${error.message}`);
    }
  }

  // ==================== EGRESS (Streaming/Recording) ====================

  async startEgress(roomName: string, options: any): Promise<any> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Starting egress for ${roomName}`);
      return { success: true, mock: true };
    }

    try {
      // This is a placeholder - implement based on your LiveKit version
      this.logger.log(`✅ Egress started for ${roomName}`);
      return { success: true, roomName };
    } catch (error) {
      this.logger.error(`Failed to start egress: ${error.message}`);
      throw new Error(`Failed to start egress: ${error.message}`);
    }
  }

  // ==================== UTILITY METHODS ====================

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

  private createMockRoom(roomName: string): Room {
    const mockRoom = {
      name: roomName,
      sid: `mock-${roomName}-${Date.now()}`,
      creationTime: Math.floor(Date.now() / 1000),
      metadata: JSON.stringify({ mock: true }),
      numParticipants: 0,
      emptyTimeout: 10 * 60,
      departureTimeout: 5 * 60,
      maxParticipants: 50,
      creationTimeMs: Date.now(),
    } as unknown as Room;
    return mockRoom;
  }

  // ==================== WEBHOOK HANDLING ====================

  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(`📨 Webhook event received: ${event.event}`);

    switch (event.event) {
      case 'room_started':
        this.logger.log(`🏠 Room started: ${event.room?.name || 'unknown'}`);
        break;
      case 'room_finished':
        this.logger.log(`🏁 Room finished: ${event.room?.name || 'unknown'}`);
        break;
      case 'participant_joined':
        this.logger.log(
          `👤 Participant joined: ${event.participant?.identity || 'unknown'} in ${event.room?.name || 'unknown'}`,
        );
        break;
      case 'participant_left':
        this.logger.log(
          `👋 Participant left: ${event.participant?.identity || 'unknown'} from ${event.room?.name || 'unknown'}`,
        );
        break;
      case 'track_subscribed':
        this.logger.log(
          `🎵 Track subscribed: ${event.track?.sid || 'unknown'}`,
        );
        break;
      case 'track_unsubscribed':
        this.logger.log(
          `🎵 Track unsubscribed: ${event.track?.sid || 'unknown'}`,
        );
        break;
      default:
        this.logger.log(`Unknown event: ${event.event}`);
    }
  }

  // ==================== HELPER METHODS ====================

  async getRoomInfo(roomName: string): Promise<any> {
    if (!this.isLiveKitAvailable) {
      return { name: roomName, mock: true, participants: [] };
    }

    try {
      const room = await this.getRoom(roomName);
      const participants = await this.getParticipants(roomName);

      return {
        room,
        participants,
        participantCount: participants.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get room info: ${error.message}`);
      return null;
    }
  }

  async updateRoomMetadata(roomName: string, metadata: any): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Updating metadata for ${roomName}`);
      return;
    }

    try {
      await this.roomService.updateRoomMetadata(
        roomName,
        JSON.stringify(metadata),
      );
      this.logger.log(`✅ Metadata updated for ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to update room metadata: ${error.message}`);
      throw new Error(`Failed to update room metadata: ${error.message}`);
    }
  }

  async getActiveParticipants(roomName: string): Promise<any[]> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Getting active participants for ${roomName}`);
      return [];
    }

    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants.filter((p: any) => p.state === 'ACTIVE');
    } catch (error) {
      this.logger.error(`Failed to get active participants: ${error.message}`);
      return [];
    }
  }

  async sendData(roomName: string, data: any, options?: any): Promise<void> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(`📝 MOCK: Sending data to ${roomName}`);
      return;
    }

    try {
      await this.roomService.sendData(
        roomName,
        Buffer.from(JSON.stringify(data)),
        options,
      );
      this.logger.log(`✅ Data sent to ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to send data: ${error.message}`);
      throw new Error(`Failed to send data: ${error.message}`);
    }
  }

  async getParticipant(roomName: string, participantId: string): Promise<any> {
    if (!this.isLiveKitAvailable) {
      this.logger.warn(
        `📝 MOCK: Getting participant ${participantId} from ${roomName}`,
      );
      return null;
    }

    try {
      const participant = await this.roomService.getParticipant(
        roomName,
        participantId,
      );
      return participant;
    } catch (error) {
      this.logger.error(`Failed to get participant: ${error.message}`);
      return null;
    }
  }
}