import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  // Session id; absent on access tokens issued before sessions were tracked
  sid?: string;
}

// 👇 Custom extractor: reads JWT from cookie first
const cookieExtractor = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies['accessToken'] || null;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor, // 1️⃣ try cookie
        ExtractJwt.fromAuthHeaderAsBearerToken(), // 2️⃣ fallback to header
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Signature and expiry are already checked; this adds "the session is still
    // live and the user still exists" (a logout or revoked login ends here).
    const user = await this.authService.authenticateSession(payload);

    if (!user) {
      throw new UnauthorizedException('Session expired or user not found');
    }

    return user;
  }
}
