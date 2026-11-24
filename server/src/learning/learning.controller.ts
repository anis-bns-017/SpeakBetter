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

import { GetVocabularyDto } from './dto/vocabulary.dto';
import {
  CreateFlashcardDto,
  ReviewFlashcardDto,
  GetFlashcardsDto,
} from './dto/flashcard.dto';
import { ExercisesService } from './exercises.service';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(
    private learningService: LearningService,
    private exercises: ExercisesService,
  ) {}

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
  getGrammar(@Query('level') level?: string) {
    return this.learningService.getGrammar({ level });
  }

  // ============ EXERCISES ============
  @Get('exercises')
  getExercises(@Request() req, @Query('level') level?: string, @Query('skill') skill?: string) {
    return this.exercises.session(req.user.id, { level, skill });
  }

  @Post('exercises/check')
  checkExercise(@Request() req, @Body() body: { id?: string; answer?: unknown }) {
    return this.exercises.check(req.user.id, body?.id, body?.answer);
  }

  @Post('exercises/finish')
  finishExercises(
    @Request() req,
    @Body() body: { level?: string; skill?: string; day?: string; round?: number; answers?: Record<string, unknown> },
  ) {
    return this.exercises.finish(req.user.id, body);
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