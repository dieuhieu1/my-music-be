import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

// Routes that require auth cookie to be present
const APP_ROUTE_PATTERN = /^\/[a-z]{2}\/(profile|artist|browse|playlists|albums|queue|feed|users|payment|downloads|admin)/;

// Routes that should redirect to /browse if the user is already logged in
const AUTH_ROUTE_PATTERN = /^\/[a-z]{2}\/(login|register|forgot-password|verify-reset|reset-password)/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const locale = pathname.split('/')[1] || defaultLocale;

  // (app) routes — no auth cookie → redirect to login
  if (APP_ROUTE_PATTERN.test(pathname) && !accessToken) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // (auth) routes — already logged in → redirect to browse
  if (AUTH_ROUTE_PATTERN.test(pathname) && accessToken) {
    return NextResponse.redirect(new URL(`/${locale}/browse`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all paths except Next.js internals and static files
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
