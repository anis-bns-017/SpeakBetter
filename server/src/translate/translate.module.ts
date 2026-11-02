import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FreeLookupProvider, LookupProvider } from './lookup.provider';
import { TranslateController } from './translate.controller';
import { TranslateService } from './translate.service';

@Module({
  controllers: [TranslateController],
  providers: [TranslateService, PrismaService, { provide: LookupProvider, useClass: FreeLookupProvider }],
  exports: [TranslateService, LookupProvider],
})
export class TranslateModule {}
