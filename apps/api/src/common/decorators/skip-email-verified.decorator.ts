import { SetMetadata } from '@nestjs/common';

export const SKIP_EMAIL_VERIFIED_KEY = 'skipEmailVerified';

// Allow authenticated users whose email is not yet verified to access the route.
// Use for: POST /auth/resend-verification-email, POST /auth/logout
export const SkipEmailVerified = () => SetMetadata(SKIP_EMAIL_VERIFIED_KEY, true);
