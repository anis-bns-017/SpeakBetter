import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { SpeakingEffectDto } from './dto/speaking-effect.dto';
import { TimezoneDto } from './dto/timezone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  async getMyProfile(@Request() req) {
    return this.profileService.getProfileByUserId(req.user.id);
  }

  /** The first-day guide: saves its answers (all optional) and marks it done */
  @Put('me/onboarding')
  async completeOnboarding(@Request() req, @Body() body: OnboardingDto) {
    return this.profileService.completeOnboarding(req.user.id, body);
  }

  /** The effect others see around your avatar while you talk in voice rooms */
  @Put('me/speaking-effect')
  async setSpeakingEffect(@Request() req, @Body() body: SpeakingEffectDto) {
    return this.profileService.setSpeakingEffect(req.user.id, body.effect);
  }

  /** The app sends the device's time zone, so streaks and daily goals follow the learner's own day */
  @Put('me/timezone')
  async setTimezone(@Request() req, @Body() body: TimezoneDto) {
    return this.profileService.setTimezone(req.user.id, body.timezone);
  }

  @Put('me')
  async updateMyProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, dto);
  }
}