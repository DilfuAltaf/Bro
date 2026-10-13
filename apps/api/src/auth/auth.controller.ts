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
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
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
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Use 'none' if frontend and backend are on different domains
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
}
