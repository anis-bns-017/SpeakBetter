import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Disappearing-message timers offered in the app (seconds); 0 = off */
export const DISAPPEARING_OPTIONS = [0, 24 * 3600, 7 * 24 * 3600, 90 * 24 * 3600] as const;

export class UpdateChatStateDto {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  /** ISO time to stay muted until; "always" mutes forever; null unmutes */
  @IsOptional()
  @IsString()
  mutedUntil?: string | null;
}

export class SetDisappearingDto {
  @IsIn(DISAPPEARING_OPTIONS as unknown as number[])
  seconds: number;
}

export class MessageIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  messageIds: string[];
}

export class ForwardMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  messageIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  chatIds: string[];
}

export class SaveMessageDto {
  @IsBoolean()
  saved: boolean;
}

export class ChatMediaQueryDto {
  @IsIn(['media', 'files', 'links'])
  kind: 'media' | 'files' | 'links';

  @IsOptional()
  @IsString()
  before?: string;
}

export class ScheduleMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'VIDEO', 'FILE'])
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsDateString()
  sendAt: string;
}

export class ReportDto {
  @IsEnum(['USER', 'MESSAGE'])
  targetType: 'USER' | 'MESSAGE';

  @IsString()
  targetId: string;

  @IsString()
  @MaxLength(100)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateChatPrivacyDto {
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  sendReadReceipts?: boolean;

  @IsOptional()
  @IsBoolean()
  showTypingIndicator?: boolean;
}

export class SetChatPinDto {
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin: string;

  @IsOptional()
  @IsString()
  currentPin?: string;
}

export class VerifyChatPinDto {
  @IsString()
  pin: string;
}
