import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,

        profile: {
          create: {
            nativeLanguage: dto.nativeLanguage || 'en',

            learningLanguages: dto.learningLanguages || ['en'],
          },
        },
      },

      include: {
        profile: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },

      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please use social login');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.profile.update({
      where: {
        userId: user.id,
      },

      data: {
        lastActive: new Date(),
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ===============================
  // GOOGLE LOGIN
  // ===============================

  async googleLogin(googleUser: {
    email: string;
    name: string;
    googleId: string;
    avatarUrl?: string;
  }) {
    const { email, name, googleId, avatarUrl } = googleUser;

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleId,
          avatarUrl, // ✅ matches schema
          profile: {
            create: {
              nativeLanguage: 'en',
              learningLanguages: ['en'],
            },
          },
        },
        include: { profile: true },
      });
    } else if (!user.googleId) {
      // Existing email user signing in with Google for the first time
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: avatarUrl ?? user.avatarUrl },
        include: { profile: true },
      });
    }

    // ✅ Explicit non-null guard — satisfies TS
    if (!user) {
      throw new UnauthorizedException('Failed to create or fetch user');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },

        include: {
          profile: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException();
      }

      const tokens = await this.generateTokens(user.id, user.email);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    return {
      success: true,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = {
      sub: userId,
      email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(
      payload,

      {
        secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),

        expiresIn: this.configService.getOrThrow<'30d'>('REFRESH_EXPIRES_IN'),
      },
    );

    await this.prisma.session.create({
      data: {
        userId,

        token: refreshToken,

        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safeUser } = user;

    return safeUser;
  }
}
