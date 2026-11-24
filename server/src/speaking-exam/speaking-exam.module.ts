import { Module } from '@nestjs/common';
import { WritingModule } from '../writing/writing.module';
import { SpeakingExamController } from './speaking-exam.controller';
import { SpeakingExamService } from './speaking-exam.service';

// Stateless: the paper is built from a seed and a score is computed from what the web app sends, so there is no table
@Module({
  imports: [WritingModule],
  controllers: [SpeakingExamController],
  providers: [SpeakingExamService],
})
export class SpeakingExamModule {}
