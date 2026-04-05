import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_EMAIL_VERIFIED_KEY } from '../decorators/skip-email-verified.decorator';

// Guard execution order (after JwtAuthGuard):
//   JwtAuthGuard → EmailVerifiedGuard → RolesGuard → handler
//
// Skip conditions:
//   @Public()              → skip entirely (no user on request)
//   @SkipEmailVerified()   → allow unverified users (e.g. resend-verification endpoint)
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipEmailVerified = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipEmailVerified) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.is_email_verified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }
    return true;
  }
}
