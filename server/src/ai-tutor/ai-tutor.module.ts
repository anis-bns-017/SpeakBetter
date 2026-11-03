import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { AiTutorController } from './ai-tutor.controller';
import { AiTutorService } from './ai-tutor.service';
import { AnthropicTutorLlm, TutorLlm } from './ai-tutor.llm';

@Module({
  imports: [LearningModule, BillingModule],
  controllers: [AiTutorController],
  providers: [AiTutorService, PrismaService, { provide: TutorLlm, useClass: AnthropicTutorLlm }],
})
export class AiTutorModule {}
