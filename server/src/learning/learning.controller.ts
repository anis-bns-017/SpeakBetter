import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LearningService } from './learning.service';
//mport { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  GetVocabularyDto,
  CreateVocabularyDto,
  ReviewVocabularyDto,
} from './dto/vocabulary.dto';
import {
  CreateFlashcardDto,
  ReviewFlashcardDto,
  GetFlashcardsDto,
} from './dto/flashcard.dto';
import { SubmitExerciseDto, GetExercisesDto } from './dto/exercise.dto';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private learningService: LearningService) {}

  // ============ VOCABULARY ============
  @Get('vocabulary')
  async getVocabulary(@Query() query: GetVocabularyDto) {
    return this.learningService.getVocabulary({
      language: query.language,
      difficulty: query.difficulty as any,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    });
  }

  @Post('vocabulary')
  async createVocabulary(@Body() data: CreateVocabularyDto) {
    return this.learningService.createVocabulary(data);
  }

  @Post('vocabulary/review')
  async reviewVocabulary(@Request() req, @Body() data: ReviewVocabularyDto) {
    return this.learningService.reviewVocabulary(req.user.id, data);
  }

  // ============ FLASHCARDS ============
  @Get('flashcards')
  async getFlashcards(@Request() req, @Query() query: GetFlashcardsDto) {
    return this.learningService.getFlashcards(req.user.id, {
      language: query.language,
      dueOnly: query.dueOnly === 'true',
    });
  }

  @Post('flashcards')
  async createFlashcard(@Request() req, @Body() data: CreateFlashcardDto) {
    return this.learningService.createFlashcard(req.user.id, data);
  }

  @Post('flashcards/review')
  async reviewFlashcard(@Request() req, @Body() data: ReviewFlashcardDto) {
    return this.learningService.reviewFlashcard(req.user.id, data);
  }

  // ============ GRAMMAR ============
  @Get('grammar')
  async getGrammar(
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
  ) {
    return this.learningService.getGrammar({
      language,
      level,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ============ EXERCISES ============
  @Get('exercises')
  async getExercises(@Query() query: GetExercisesDto) {
    return this.learningService.getExercises({
      language: query.language,
      type: query.type,
      difficulty: query.difficulty,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
  }

  @Post('exercises/submit')
  async submitExercise(@Request() req, @Body() data: SubmitExerciseDto) {
    return this.learningService.submitExercise(req.user.id, data);
  }

  // ============ PROGRESS ============
  @Get('progress')
  async getProgress(@Request() req) {
    return this.learningService.getProgress(req.user.id);
  }

  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.learningService.getDashboard(req.user.id);
  }
}