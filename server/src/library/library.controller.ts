import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LibraryService } from './library.service';

@ApiTags('library')
@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private library: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Every story, dialogue and article, with your progress' })
  list(@Req() req: any) {
    return this.library.list(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One text to read and listen to, with its questions' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.library.get(req.user.id, id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Check your answers: { answers: { q1: 2, q2: 0, ... } } (index of the option chosen)' })
  answer(@Req() req: any, @Param('id') id: string, @Body() body: { answers?: Record<string, number> }) {
    return this.library.answer(req.user.id, id, body?.answers);
  }
}
