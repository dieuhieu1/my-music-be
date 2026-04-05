import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Mark a route as public — skips JwtAuthGuard and EmailVerifiedGuard.
// Use for: health check, login, register, drop teaser, artist public profile.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
