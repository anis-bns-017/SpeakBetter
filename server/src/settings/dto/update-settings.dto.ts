import { IsOptional, IsBoolean, IsString, Matches, MaxLength } from 'class-validator';
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
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsBoolean()
  dailyReminderEnabled?: boolean;

  /** "HH:mm" on the learner's own clock; null clears it */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Reminder time must look like 19:30' })
  dailyReminderTime?: string | null;

  @IsOptional()
  @IsBoolean()
  shareActivityWithFriends?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  showProfilePublic?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFriendRequests?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDirectMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  autoTranslateMessages?: boolean;
}
