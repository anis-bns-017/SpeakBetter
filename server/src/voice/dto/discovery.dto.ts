import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean, // ✅ Added this import
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RoomSortType {
  TRENDING = 'trending',
  NEWEST = 'newest',
  POPULAR = 'popular',
  NEARBY = 'nearby',
  RECOMMENDED = 'recommended',
}

export enum RoomFilterType {
  ALL = 'all',
  OPEN = 'OPEN',
  STAGE = 'STAGE',
  SCHEDULED = 'SCHEDULED',
  LANGUAGE = 'LANGUAGE',
  PRIVATE = 'PRIVATE',
}

export class DiscoverRoomsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(RoomSortType)
  sort?: RoomSortType;

  @IsOptional()
  @IsEnum(RoomFilterType)
  filter?: RoomFilterType;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** Only rooms with at least this many people in them now */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  minParticipants?: number;

  /** Only rooms with at most this many people in them now */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxParticipants?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RoomCategoryDto {
  @IsString()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsNumber()
  roomCount: number;
}

export class TrendingRoomDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  type: string;

  @IsString()
  creatorId: string;

  @IsString()
  creatorName: string;

  @IsOptional()
  @IsString()
  creatorAvatar?: string;

  @IsNumber()
  participantCount: number;

  @IsNumber()
  peakParticipantCount: number;

  @IsNumber()
  messageCount: number;

  @IsNumber()
  speakingHours: number;

  @IsNumber()
  trendScore: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  tags: string[];

  @IsBoolean()
  isLive: boolean;

  @IsString()
  createdAt: string;
}