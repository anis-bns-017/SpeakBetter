import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RATINGS, type Rating } from '../srs';

export class AnswerReviewDto {
  @IsIn(['card', 'word'])
  type: 'card' | 'word';

  @IsString()
  @MaxLength(60)
  id: string;

  @IsIn([...RATINGS])
  rating: Rating;
}

export class GetReviewQueueDto {
  /** "1" to include cards that are not due yet */
  @IsOptional()
  @IsString()
  all?: string;

  @IsOptional()
  @IsIn(['word', 'correction'])
  kind?: 'word' | 'correction';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  pattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
