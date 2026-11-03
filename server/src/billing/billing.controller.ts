import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'The plans, what each includes, their prices, and whether paying works right now' })
  plans() {
    return this.billing.catalog();
  }

  @Get('me')
  @ApiOperation({ summary: 'My plan, how long it lasts, and what it allows' })
  me(@Req() req: any) {
    return this.billing.getMine(req.user.id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'My payment history' })
  payments(@Req() req: any) {
    return this.billing.payments(req.user.id);
  }

  @Post('checkout')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'billing-checkout', limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Start paying for a plan: { plan: "PRO", interval: "MONTHLY" | "YEARLY" }' })
  checkout(@Req() req: any, @Body() body: { plan?: unknown; interval?: unknown }) {
    return this.billing.startCheckout(req.user.id, body?.plan, body?.interval);
  }

  @Get('checkout/:id')
  @ApiOperation({ summary: 'What a checkout is for (amount, plan, status)' })
  checkoutDetails(@Req() req: any, @Param('id') id: string) {
    return this.billing.getCheckout(req.user.id, id);
  }

  @Post('checkout/:id/sandbox')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'billing-sandbox', limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Test checkout only: pretend the payment succeeded, failed or was cancelled' })
  sandbox(@Req() req: any, @Param('id') id: string, @Body() body: { outcome?: unknown }) {
    return this.billing.settleSandbox(req.user.id, id, body?.outcome);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Stop renewing; Pro keeps working until the paid time ends' })
  cancel(@Req() req: any) {
    return this.billing.cancel(req.user.id);
  }

  @Post('resume')
  @ApiOperation({ summary: 'Undo a cancellation before the paid time ends' })
  resume(@Req() req: any) {
    return this.billing.resume(req.user.id);
  }
}
