import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentProvider, SandboxPaymentProvider } from './payment-provider';

@Module({
  imports: [NotificationsModule],
  controllers: [BillingController],
  // Swap SandboxPaymentProvider for a real provider here when payments go live
  providers: [BillingService, PrismaService, { provide: PaymentProvider, useClass: SandboxPaymentProvider }],
  exports: [BillingService],
})
export class BillingModule {}
