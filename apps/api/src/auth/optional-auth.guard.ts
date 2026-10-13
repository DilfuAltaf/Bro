import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.['token'];
    
    if (token) {
      const userId = this.authService.verifyToken(token);
      if (userId) {
        request.user = { id: userId };
      }
    }
    
    return true; // We don't block guests here, we just attach user if authenticated.
  }
}
