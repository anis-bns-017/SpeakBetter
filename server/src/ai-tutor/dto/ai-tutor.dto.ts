import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StartTutorSessionDto {
  @IsString()
  @MaxLength(30)
  scenario: string;

  /** CEFR code to speak at; defaults to the level from the placement test (B1 if none) */
  @IsOptional()
  @IsString()
  @MaxLength(2)
  level?: string;
}

export class TutorTurnDto {
  /** What the learner said or typed (speech-to-text output is fine) */
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  text: string;
}
