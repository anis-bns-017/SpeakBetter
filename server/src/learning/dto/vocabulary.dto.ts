import { IsString, IsOptional } from 'class-validator';

export class GetVocabularyDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  difficulty?: 'beginner' | 'intermediate' | 'advanced';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}
