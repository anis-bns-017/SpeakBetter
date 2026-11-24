import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const entry = profile.emails?.[0];
    const email = entry?.value;

    if (!email) {
      throw new UnauthorizedException('Google account email not found');
    }
    // Signing in links by address, so it must be one Google has checked
    if (String((entry as { verified?: unknown }).verified) === 'false') {
      throw new UnauthorizedException('Confirm this email with Google first');
    }

    const user = {
      email,
      name: profile.displayName,
      googleId: profile.id,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };

    done(null, user);
    return user;
  }
}
