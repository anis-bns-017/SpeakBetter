import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  IsUUID,
  IsNumber,
  IsNotEmpty,
  IsObject,
  IsUrl,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChatDto {
  @IsEnum(['PRIVATE', 'GROUP'])
  type: 'PRIVATE' | 'GROUP';

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsString({ each: true }) // cuid, not UUID
  participantIds: string[];
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  // Optional: voice notes, images, gifs, and stickers can be sent with no text content
  @IsOptional()
  @IsString()
  content?: string;

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
    'SYSTEM',
    'CORRECTION',
  ])
  type?: string;

  /** CORRECTION: { note?: string } */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString() // cuid, not UUID
  replyToId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number; // For voice messages

  /** Photo/video the recipient can open only once */
  @IsOptional()
  @IsBoolean()
  isViewOnce?: boolean;

  /** Album: several photos/videos in one message */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentInputDto)
  attachments?: MessageAttachmentInputDto[];
}

export class MessageAttachmentInputDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @IsEnum(['IMAGE', 'VIDEO'])
  type: 'IMAGE' | 'VIDEO';

  @IsString()
  @MaxLength(255)
  filename: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsNumber()
  @Min(0)
  size: number;
}

export class GetMessagesDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  before?: string; // message id
}

export class MarkReadDto {
  @IsString()
  chatId: string;

  @IsString()
  messageId: string;
}

export class TypingDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsBoolean()
  isTyping: boolean;
}

export class AddReactionDto {
  @IsString()
  messageId: string;

  @IsString()
  emoji: string;
}

export class RemoveReactionDto {
  @IsString()
  messageId: string;

  @IsString()
  emoji: string;
}

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true }) // cuid, not UUID
  participantIds: string[];
}

export class AddParticipantsDto {
  @IsArray()
  @IsString({ each: true }) // cuid, not UUID
  userIds: string[];
}

export class RemoveParticipantDto {
  @IsString() // cuid, not UUID
  userId: string;
}

// ============ NEW DTOS ============

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class PinMessageDto {
  @IsBoolean()
  pinned: boolean;
}

export class DeleteMessageDto {
  @IsString()
  messageId: string;
}

export class GetCommunityMessagesDto {
  @IsString()
  communityId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  before?: string;
}

export class SearchMessagesDto {
  @IsString()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  query: string;
}

export class SendVoiceMessageDto {
  @IsString()
  chatId: string;

  @IsString()
  audioUrl: string;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class PinChatDto {
  @IsString()
  chatId: string;

  @IsBoolean()
  pinned: boolean;
}

export class MuteChatDto {
  @IsString()
  chatId: string;

  @IsBoolean()
  muted: boolean;
}

export class MessageFilterDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsBoolean()
  hasMedia?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class MessageResponseDto {
  id: string;
  chatId?: string;
  communityId?: string;
  senderId: string;
  sender?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  content: string | null;
  type: string;
  mediaUrl?: string;
  fileUrl?: string;
  replyToId?: string;
  replyTo?: any;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  reactions?: any[];
  attachments?: any[];
  translations?: any[];
}

export class ChatResponseDto {
  id: string;
  type: 'PRIVATE' | 'GROUP' | 'CHANNEL' | 'THREAD';
  name?: string;
  description?: string;
  avatarUrl?: string;
  isPublic?: boolean;
  ownerId?: string;
  participants?: any[];
  messages?: any[];
  createdAt: Date;
  updatedAt: Date;
}

export class UnreadCountDto {
  chatId: string;
  count: number;
}

export class TypingResponseDto {
  userId: string;
  chatId?: string;
  communityId?: string;
  isTyping: boolean;
}
