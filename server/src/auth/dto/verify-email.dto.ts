import { IsString, MaxLength } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @MaxLength(200)
  token: string;
}
