import { Module } from '@nestjs/common';
import { PlacementController } from './placement.controller';
import { PlacementService } from './placement.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PlacementController],
  providers: [PlacementService, PrismaService],
  exports: [PlacementService],
})
export class PlacementModule {}
