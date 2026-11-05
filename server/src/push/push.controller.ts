import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { PushService, type SubscribeInput } from './push.service';

@ApiTags('push')
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private push: PushService) {}

  @Get('config')
  @ApiOperation({ summary: 'Whether push is switched on, and the public key a browser needs to subscribe' })
  config() {
    return { enabled: this.push.enabled, publicKey: this.push.publicKey() };
  }

  @Get('status')
  @ApiOperation({ summary: 'How many of your devices get push notifications' })
  status(@Req() req: any) {
    return this.push.status(req.user.id);
  }

  @Post('subscribe')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'push-subscribe', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Save this browser for push: { subscription: { endpoint, keys: { p256dh, auth } }, timezone? }' })
  subscribe(
    @Req() req: any,
    @Headers('user-agent') userAgent: string | undefined,
    @Body() body: { subscription?: SubscribeInput; timezone?: string },
  ) {
    return this.push.subscribe(req.user.id, body?.subscription ?? { endpoint: undefined }, { userAgent, timezone: body?.timezone });
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Stop push on this browser: { endpoint }' })
  unsubscribe(@Req() req: any, @Body() body: { endpoint?: string }) {
    return this.push.unsubscribe(req.user.id, body?.endpoint);
  }

  @Post('test')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'push-test', limit: 5, windowMs: 60_000 })
  @ApiOperation({ summary: 'Send yourself a test notification' })
  async test(@Req() req: any) {
    const sent = await this.push.sendToUser(req.user.id, {
      title: 'Notifications are on',
      body: "That's it. You'll get a reminder when it's time to practise.",
      url: '/dashboard',
      tag: 'push-test',
    });
    return { sent, enabled: this.push.enabled };
  }
}
