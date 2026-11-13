import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** Every field is optional: each step of the guide can be skipped (values are checked in onboarding.ts) */
export class OnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  nativeLanguage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  goals?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  selfLevel?: string;

  @IsOptional()
  @IsInt()
  dailyGoalMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  interfaceLanguage?: string;
}
