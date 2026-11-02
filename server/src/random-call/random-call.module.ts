import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from '../voice/livekit.service';
import { MatchQueue } from './match-queue';
import { MatchmakerService } from './matchmaker.service';
import { RandomCallBroadcaster } from './random-call.broadcaster';
import { RandomCallController } from './random-call.controller';
import { RandomCallGateway } from './random-call.gateway';
import { RandomCallService } from './random-call.service';

/**
 * Random one-to-one calls: matching, call rooms, reports and restrictions.
 * REALTIME_REDIS_URL (see RedisModule) makes the queue and events work across
 * several server instances.
 */
@Module({
  // ActivityService: XP and streaks for finished calls
  imports: [AuthModule, LearningModule],
  controllers: [RandomCallController],
  providers: [
    PrismaService,
    LiveKitService,
    MatchQueue,
    RandomCallBroadcaster,
    RandomCallService,
    MatchmakerService,
    RandomCallGateway,
  ],
})
export class RandomCallModule {}
