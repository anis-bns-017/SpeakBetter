import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleplayService } from './roleplay.service';

@ApiTags('roleplay')
@Controller('roleplay')
@UseGuards(JwtAuthGuard)
export class RoleplayController {
  constructor(private roleplay: RoleplayService) {}

  @Get()
  @ApiOperation({ summary: 'Every role-play scenario with your progress' })
  list(@Req() req: any) {
    return this.roleplay.list(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One scenario: the setting, the conversation and useful phrases' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.roleplay.get(req.user.id, id);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Save a finished conversation: { scores: [92, null, 78, ...] } (null = not said aloud)' })
  finish(@Req() req: any, @Param('id') id: string, @Body() body: { scores?: unknown }) {
    return this.roleplay.finish(req.user.id, id, body?.scores);
  }
}
