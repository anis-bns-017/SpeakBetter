import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { SessionCleanupService } from './session-cleanup.service';

import { PrismaService } from '../prisma.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { PasswordResetService } from './password-reset.service';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [
    ConfigModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<'7d'>('JWT_EXPIRES_IN'),
        },
      }),
    }),

    UsersModule,
    MailModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    GoogleStrategy,
    SessionCleanupService,
    PasswordResetService,
    AccountDeletionService,
  ],

  exports: [JwtModule, PassportModule, JwtStrategy, AuthService],
})
export class AuthModule {}
