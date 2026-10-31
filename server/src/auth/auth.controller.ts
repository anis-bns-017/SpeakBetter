import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';

import { AuthService, SessionMeta } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.sessionMeta(req));

    this.setAuthCookies(res, result);

    return {
      user: result.user,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.sessionMeta(req));

    this.setAuthCookies(res, result);

    return {
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    let result: Awaited<ReturnType<AuthService['refreshToken']>>;
    try {
      result = await this.authService.refreshToken(
        refreshToken,
        this.sessionMeta(req),
      );
    } catch (error) {
      // A dead token is useless; stop sending it. NOT on a tab race: the
      // winning request is setting fresh cookies and must not be wiped.
      if (
        error instanceof UnauthorizedException &&
        (error.getResponse() as { code?: string })?.code !== 'REFRESH_RACE'
      ) {
        this.clearAuthCookies(res);
      }
      throw error;
    }

    this.setAuthCookies(res, result);

    return {
      user: result.user,
    };
  }

  // ==============================
  // GOOGLE LOGIN
  // ==============================

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: ExpressRequest, @Res() res: Response) {
    const result = await this.authService.googleLogin(
      req.user as any,
      this.sessionMeta(req),
    );

    this.setAuthCookies(res, result);

    // 👇 redirect back to your frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return res.redirect(`${frontendUrl}/auth/callback`);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: ExpressRequest) {
    // Re-read through the service so the password hash never leaves the server
    return this.authService.getMe((req.user as { id: string }).id);
  }

  /**
   * Public on purpose: it must work when the access cookie has already
   * expired. It ends the login the cookies belong to (the whole session
   * family) and always clears the cookies, even if revoking failed.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const accessToken = req.cookies?.accessToken;

      if (refreshToken) {
        await this.authService.logoutByRefreshToken(refreshToken);
      }
      if (accessToken) {
        await this.authService.logoutByAccessToken(accessToken);
      }
    } finally {
      this.clearAuthCookies(res);
    }

    return {
      success: true,
    };
  }

  private sessionMeta(req: ExpressRequest): SessionMeta {
    return {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setAuthCookies(
    res: Response,
    result: {
      accessToken: string;
      refreshToken: string;
    },
  ) {
    res.cookie('accessToken', result.accessToken, {
      ...this.cookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  /** Same attributes as when the cookies were set, so the browser matches them */
  private clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', this.cookieOptions());
    res.clearCookie('refreshToken', this.cookieOptions());
  }
}
