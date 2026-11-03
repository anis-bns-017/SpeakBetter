import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InsightsService } from './insights.service';
import { PlanService } from './plan.service';

export class SetGoalDto {
  @IsInt()
  minutes: number;
}

@ApiTags('insights')
@Controller()
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(
    private plan: PlanService,
    private insights: InsightsService,
  ) {}

  @Get('plan/today')
  @ApiOperation({ summary: "Today's plan: a few tasks that fit your daily minutes, with live progress" })
  today(@Req() req: any) {
    return this.plan.getToday(req.user.id);
  }

  @Put('plan/goal')
  @ApiOperation({ summary: 'Set how many minutes a day you want to practise (5, 10, 20 or 30)' })
  setGoal(@Req() req: any, @Body() body: SetGoalDto) {
    return this.plan.setGoal(req.user.id, body.minutes);
  }

  @Get('insights/progress')
  @ApiOperation({ summary: 'Your progress: 12-week calendar, this week vs last, mistakes, pronunciation, levels' })
  progress(@Req() req: any) {
    return this.insights.getProgress(req.user.id);
  }
}
