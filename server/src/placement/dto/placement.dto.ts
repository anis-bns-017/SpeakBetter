import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AnswerPlacementDto {
  @IsString()
  @MaxLength(40)
  itemId: string;

  /** Position of the chosen option in the list the server sent (0–3); omit when skipping */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  choice?: number;

  /** "I don't know": counts as a miss, so guessing doesn't inflate the level */
  @IsOptional()
  @IsBoolean()
  skip?: boolean;

  /** Milliseconds the learner took, for analytics only */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  ms?: number;
}

export class SpeakingSampleDto {
  @IsString()
  @MaxLength(3000)
  transcript: string;

  @IsNumber()
  @Min(1)
  @Max(300)
  seconds: number;
}
