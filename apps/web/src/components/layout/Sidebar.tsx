'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const navItems = [
  { href: '/browse', label: 'Browse' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/playlists/liked', label: 'Liked Songs' },
  { href: '/playlists/saved', label: 'Saved Playlists' },
  { href: '/feed', label: 'Activity Feed' },
];

const artistItems = [
  { href: '/artist/profile', label: 'My Artist Profile' },
  { href: '/artist/songs', label: 'My Songs' },
  { href: '/artist/upload', label: 'Upload Song' },
  { href: '/artist/analytics', label: 'Analytics' },
  { href: '/artist/drops', label: 'Live Drops' },
];

export default function Sidebar() {
  const { locale } = useParams<{ locale: string }>();
  const { user, hasRole } = useAuthStore();
  const isArtist = hasRole(Role.ARTIST);
  const isAdmin = hasRole(Role.ADMIN);

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-card p-4">
      <Link href={`/${locale}`} className="mb-6 text-xl font-bold text-primary">
        🎵 My Music
      </Link>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={`/${locale}${item.href}`}
            className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            {item.label}
          </Link>
        ))}

        {(isArtist || isAdmin) && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
              Artist
            </div>
            {artistItems.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
              Admin
            </div>
            <Link
              href={`/${locale}/admin`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              Admin Dashboard
            </Link>
          </>
        )}
      </nav>

      <div className="mt-4 space-y-2 border-t pt-4">
        <LanguageSwitcher />
        {user && (
          <Link
            href={`/${locale}/profile`}
            className="block truncate text-sm text-muted-foreground hover:text-foreground"
          >
            {user.name}
          </Link>
        )}
      </div>
    </aside>
  );
}
