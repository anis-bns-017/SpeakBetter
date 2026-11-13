import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ReasonDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class OptionalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class WarnDto {
  @IsString()
  @MaxLength(300)
  message: string;
}

export class SuspendDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsString()
  @MaxLength(300)
  reason: string;
}

export class RoleDto {
  @IsIn(['USER', 'MODERATOR', 'ADMIN'])
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

export class GrantProDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  days: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class DeleteUserDto {
  @IsString()
  @MaxLength(320)
  confirmEmail: string;

  @IsString()
  @MaxLength(300)
  reason: string;
}

export class ResolveReportDto {
  @IsIn(['dismiss', 'action'])
  decision: 'dismiss' | 'action';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  warn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  suspendDays?: number;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @IsBoolean()
  deleteContent?: boolean;
}

export class HideCommunityDto {
  @IsBoolean()
  hidden: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BroadcastDto {
  @IsString()
  @MaxLength(80)
  title: string;

  @IsString()
  @MaxLength(400)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  link?: string;

  @IsIn(['all', 'active7', 'active30', 'pro', 'free', 'staff'])
  audience: 'all' | 'active7' | 'active30' | 'pro' | 'free' | 'staff';
}
