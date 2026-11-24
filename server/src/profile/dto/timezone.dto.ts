import { IsString, MaxLength } from 'class-validator';

/** The time zone the learner's device is in ("Asia/Dhaka"), so their days start at their own midnight */
export class TimezoneDto {
  @IsString()
  @MaxLength(64)
  timezone: string;
}
