import { Role } from '@mymusic/types';

/** Returns the home route for a user based on their highest role.
 *  Admins land on /browse after regular login; use /admin-login for the admin portal. */
export function getRoleHome(roles: string[] | undefined, locale: string): string {
  if (!roles || roles.length === 0) return `/${locale}/browse`;
  if (roles.includes(Role.ARTIST)) return `/${locale}/artist/songs`;
  return `/${locale}/browse`;
}
