import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitAttemptDto {
  /** What you were asked to say */
  @IsString()
  @MaxLength(300)
  target: string;

  /** The recogniser's guesses at what you said, best first */
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(400, { each: true })
  heard: string[];

  /** The recogniser's confidence in its first guess (0-1) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  /** The sound being practised (TH, V_W...) */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  sound?: string;

  @IsOptional()
  @IsIn(['sound', 'sentence', 'word'])
  source?: 'sound' | 'sentence' | 'word';

  /** How long the speaking took, for the pace (milliseconds) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120_000)
  durationMs?: number;
}

export class CheckSoundsDto {
  /**
   * What the on-device recogniser heard, 20 ms at a time: a number is that many silent frames, a list is one
   * frame as [blank, label, probability, label, probability, ...]
   */
  @IsArray()
  @ArrayMaxSize(1500)
  frames: unknown[];
}
