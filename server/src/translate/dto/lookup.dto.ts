import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LookupQueryDto {
  /** The word or short phrase to look up */
  @IsString()
  @MaxLength(400)
  text: string;

  /** A language name or code; defaults to the native language on the profile */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  target?: string;
}
