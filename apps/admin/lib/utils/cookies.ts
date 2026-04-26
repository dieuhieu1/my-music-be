const TOKEN_KEY = 'admin_token';

export function setAdminToken(token: string) {
  const maxAge = 60 * 15; // 15 minutes
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function getAdminToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${TOKEN_KEY}=`))
    ?.split('=')[1];
}

export function clearAdminToken() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Strict`;
}
