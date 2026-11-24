import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Pictures come from our uploads or a normal web address */
const PICTURE = /^(https?:\/\/|\/)/;

export class CreateCommunityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(PICTURE)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(PICTURE)
  bannerUrl?: string;

  @IsEnum(['PUBLIC', 'PRIVATE', 'RESTRICTED'])
  type: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
}

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(PICTURE)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(PICTURE)
  bannerUrl?: string;

  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE', 'RESTRICTED'])
  type?: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
}

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsEnum(['TEXT', 'VOICE', 'ANNOUNCEMENT', 'CATEGORY'])
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'CATEGORY';

  // Ids here are cuids, so this can't be checked as a UUID
  @IsOptional()
  @IsString()
  @MaxLength(40)
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class CreateThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;
}

export class CreateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class UpdateThreadDto {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class ReportPostDto {
  @IsIn(['HARASSMENT', 'SEXUAL', 'HATE', 'SPAM', 'OTHER'])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class AddMemberDto {
  @IsString()
  @MaxLength(40)
  userId: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'MODERATOR', 'MEMBER'])
  role?: 'ADMIN' | 'MODERATOR' | 'MEMBER';
}

export class UpdateMemberRoleDto {
  @IsEnum(['ADMIN', 'MODERATOR', 'MEMBER'])
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
}

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  permissions: string[];

  @IsNumber()
  @Min(0)
  @Max(1000)
  position: number;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class BanMemberDto {
  @IsString()
  @MaxLength(40)
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
