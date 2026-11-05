import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicProfileService } from './public-profile.service';

@ApiTags('profile')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class PublicProfileController {
  constructor(private profiles: PublicProfileService) {}

  @Get(':id/profile')
  @ApiOperation({ summary: "Someone's public profile: level, streak, badges, league and how you are connected" })
  get(@Req() req: any, @Param('id') id: string) {
    return this.profiles.get(req.user.id, id);
  }
}
