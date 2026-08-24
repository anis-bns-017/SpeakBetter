// server/src/voice/dto/voice.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ============ ROOM DTOS ============

export class CreateVoiceRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['OPEN', 'PRIVATE', 'SCHEDULED', 'STAGE'])
  type: 'OPEN' | 'PRIVATE' | 'SCHEDULED' | 'STAGE';

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(100)
  maxParticipants?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  invitedUserIds?: string[];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  password?: string;
}

export class UpdateVoiceRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRecording?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(100)
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  password?: string;
}

// ============ PARTICIPANT DTOS ============

export class JoinVoiceRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class LeaveVoiceRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class UpdateRoleDto {
  @IsEnum(['SPEAKER', 'LISTENER', 'STAGE_SPEAKER', 'MODERATOR'])
  role: 'SPEAKER' | 'LISTENER' | 'STAGE_SPEAKER' | 'MODERATOR';
}

export class KickUserDto {
  @IsUUID(4)
  userId: string;
}

export class MuteUserDto {
  @IsUUID(4)
  userId: string;
}

// ============ STAGE DTOS ============

export class StageActionDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsUUID(4)
  userId: string;
}

export class CreateStageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  speakers?: string[];
}

// ============ HAND DTOS ============

export class RaiseHandDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return Boolean(value);
  })
  raise: boolean;
}

// ============ CHAT MESSAGE DTOS ============

export class SendVoiceMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsEnum([
    'TEXT',
    'IMAGE',
    'VIDEO',
    'AUDIO',
    'FILE',
    'VOICE_NOTE',
    'GIF',
    'STICKER',
    'LOCATION',
    'CONTACT',
  ])
  type?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class VoiceMessageHistoryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  before?: string;
}

// ============ RECORDING DTOS ============

export class StartRecordingDto {
  @IsUUID(4)
  roomId: string;
}

export class StopRecordingDto {
  @IsUUID(4)
  roomId: string;
}

// ============ PIN DTOS ============

export class PinMessageDto {
  @IsUUID(4)
  messageId: string;

  @IsBoolean()
  pinned: boolean;
}

// ============ DELETE DTOS ============

export class DeleteMessageDto {
  @IsUUID(4)
  messageId: string;
}

// ============ RESPONSE DTOS ============

export class VoiceRoomResponseDto {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  creatorId: string;
  creator?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  scheduledFor?: Date;
  maxParticipants: number;
  isRecording: boolean;
  liveKitRoomId?: string;
  language?: string;
  topics: string[];
  categories: string[];
  tags: string[];
  participants?: VoiceParticipantResponseDto[];
  recordings?: RecordingResponseDto[];
  stages?: StageResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class VoiceParticipantResponseDto {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  role: string;
  isMuted: boolean;
  isDeafened: boolean;
  raisedHand: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export class RecordingResponseDto {
  id: string;
  url: string;
  duration: number;
  size?: number;
  transcript?: string;
  createdAt: Date;
}

export class StageResponseDto {
  id: string;
  name: string;
  speakers: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============ QUERY DTOS ============

export class VoiceRoomQueryDto {
  @IsOptional()
  @IsEnum(['OPEN', 'PRIVATE', 'SCHEDULED', 'STAGE'])
  type?: string;

  @IsOptional()
  @IsEnum(['WAITING', 'ACTIVE', 'ENDED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ============ LIVEKIT DTOS ============

export class LiveKitTokenDto {
  token: string;
  roomName: string;
  participantIdentity: string;
  expiresAt: Date;
}

export class LiveKitRoomDto {
  name: string;
  maxParticipants?: number;
  emptyTimeout?: number;
  creationTime?: bigint;
}

// ============ JOIN ROOM RESPONSE DTO ============

export class JoinRoomResponseDto {
  participant: VoiceParticipantResponseDto;
  token: string;
  liveKitRoomId: string;
  room?: {
    id: string;
    name: string;
    liveKitRoomId?: string;
  };
  alreadyJoined?: boolean;
}

// ============ LIVEKIT STATUS DTO ============

export class LiveKitStatusDto {
  available: boolean;
  host: string;
  httpUrl: string;
  wsUrl: string;
  apiKey: string;
}

// ============ VOICE ROOM WITH PARTICIPANTS DTO ============

export class VoiceRoomWithParticipantsDto extends VoiceRoomResponseDto {
  participantCount: number;
  isLive: boolean;
}
