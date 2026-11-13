import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class DeleteAccountDto {
  /** For accounts with a password */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  /** For Google-only accounts: the email typed out */
  @IsOptional()
  @IsString()
  @MaxLength(320)
  confirmEmail?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token: string;

  /** Length and strength are checked by PasswordResetService (with friendlier messages) */
  @IsString()
  @MaxLength(200)
  password: string;
}
