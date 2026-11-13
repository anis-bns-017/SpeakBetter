import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
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
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { PasswordResetService } from './password-reset.service';
import { DeleteAccountDto, ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccountDeletionService } from './account-deletion.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  // ===============================
  // WHERE I'M SIGNED IN
  // ===============================

  /** The login (session family) this request belongs to */
  private async currentFamily(req: ExpressRequest): Promise<string | null> {
    const header = req.headers.authorization;
    const token = req.cookies?.accessToken || (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return null;
    return (await this.authService.authenticateAccessToken(token))?.familyId ?? null;
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async sessions(@Request() req: ExpressRequest) {
    return this.authService.listSessions((req.user as { id: string }).id, await this.currentFamily(req));
  }

  /** Signs out every other device, keeping this one signed in */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'sign-out-others', limit: 10, windowMs: 60 * 60_000 })
  @Post('sessions/sign-out-others')
  @HttpCode(HttpStatus.OK)
  async signOutOthers(@Request() req: ExpressRequest) {
    return this.authService.logoutOthers((req.user as { id: string }).id, await this.currentFamily(req));
  }

  /** Signs out one other device */
  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/sign-out')
  @HttpCode(HttpStatus.OK)
  async signOutSession(@Request() req: ExpressRequest, @Param('id') id: string) {
    const current = await this.currentFamily(req);
    if (id === current) throw new BadRequestException('Use "Sign out" to sign out of this device');
    return this.authService.logoutFamily((req.user as { id: string }).id, id);
  }

  // ===============================
  // DELETE MY ACCOUNT
  // ===============================

  /** What deleting your account would remove, and how you'll confirm it */
  @UseGuards(JwtAuthGuard)
  @Get('me/deletion')
  deletionPreview(@Request() req: ExpressRequest) {
    return this.accountDeletion.preview((req.user as { id: string }).id);
  }

  /** Deletes your account for good (asks for your password, or your email if you sign in with Google) */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'delete-account', limit: 5, windowMs: 60 * 60_000 })
  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Request() req: ExpressRequest,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.accountDeletion.remove((req.user as { id: string }).id, dto);
    this.clearAuthCookies(res);
    return result;
  }

  // ===============================
  // FORGOT / RESET PASSWORD
  // ===============================

  /** Emails a one-time reset link. Always the same answer, so it can't reveal who has an account. */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'forgot-password', limit: 10, windowMs: 60 * 60_000, byBodyField: { field: 'email', limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: ExpressRequest) {
    return this.passwordReset.request(dto.email, req.ip);
  }

  /** Whether a reset link still works (so the page can say so before you type) */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'reset-check', limit: 60, windowMs: 60_000 })
  @Get('reset-password/check')
  checkResetToken(@Query('token') token: string) {
    return this.passwordReset.check(token);
  }

  /** Sets a new password from a reset link, then signs the account out everywhere */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'reset-password', limit: 20, windowMs: 60 * 60_000 })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.reset(dto.token, dto.password);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'register', limit: 10, windowMs: 60 * 60_000 })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'login',
    limit: 30,
    windowMs: 15 * 60_000,
    byBodyField: { field: 'email', limit: 10 },
  })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'refresh', limit: 120, windowMs: 60_000 })
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
