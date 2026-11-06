import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';
import { Theme } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  soundEffects?: boolean;

  @IsOptional()
  // The web app sends 'dark'; the column stores DARK
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  dailyReminderTime?: string;

  @IsOptional()
  @IsBoolean()
  shareActivityWithFriends?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;
}
