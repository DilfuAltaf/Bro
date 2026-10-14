import { Controller, Post, Get, Patch, Delete, Body, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(body);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', this.cookieOpts());
    return { success: true };
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const userId = this.requireUserId(req);
    const user = await this.authService.getMe(userId);
    return { user };
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() body: any) {
    const userId = this.requireUserId(req);
    const user = await this.authService.updateMe(userId, body);
    return { user };
  }

  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() body: any) {
    const userId = this.requireUserId(req);
    return this.authService.changePassword(userId, body);
  }

  @Get('stats')
  async getStats(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.authService.getStats(userId);
  }

  @Delete('me')
  async deleteAccount(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = this.requireUserId(req);
    const result = await this.authService.deleteAccount(userId);
    res.clearCookie('token', this.cookieOpts());
    return result;
  }

  private requireUserId(req: Request): string {
    const token = req.cookies?.['token'];
    if (!token) throw new UnauthorizedException('Not authenticated');

    const userId = this.authService.verifyToken(token);
    if (!userId) throw new UnauthorizedException('Invalid token');
    return userId;
  }

  private setCookie(res: Response, token: string) {
    res.cookie('token', token, {
      ...this.cookieOpts(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Opsi cookie auth terpusat (set & clear HARUS sama, kalau tidak
   * browser menolak menghapus cookie saat logout/hapus akun).
   *
   * - Production (frontend & backend beda domain, mis. Vercel + Railway):
   *   SameSite=None + Secure, kalau tidak browser tidak akan mengirim
   *   cookie cross-site dan semua request auth bakal 401.
   * - Dev localhost (http): tetap Lax + non-secure karena cookie Secure
   *   ditolak di http://localhost.
   * - Override manual via COOKIE_SAMESITE=lax|none bila diperlukan.
   */
  private cookieOpts(): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'none'; path: string } {
    const isProd = process.env.NODE_ENV === 'production';
    const override = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
    const sameSite: 'lax' | 'none' =
      override === 'none' || override === 'lax'
        ? override
        : isProd
          ? 'none'
          : 'lax';
    // SameSite=None wajib Secure; di dev http paksa non-secure.
    const secure = sameSite === 'none' ? true : isProd;
    return { httpOnly: true, secure, sameSite, path: '/' };
  }
}
