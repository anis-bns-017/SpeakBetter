import { IsIn, IsString, IsOptional } from 'class-validator';
import { RATINGS, type Rating } from '../srs';

export class CreateFlashcardDto {
  @IsString()
  front: string;

  @IsString()
  back: string;

  @IsString()
  language: string;
}

export class ReviewFlashcardDto {
  @IsString()
  flashcardId: string;

  /** Newer clients: how well you knew it */
  @IsOptional()
  @IsIn([...RATINGS])
  rating?: Rating;

  /** Older clients: easy / medium / hard */
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';
}

export class GetFlashcardsDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  dueOnly?: string;
}