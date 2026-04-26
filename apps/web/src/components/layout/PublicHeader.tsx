'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, User, Music2, KeyRound, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/lib/api/auth.api';
import { Role } from '@mymusic/types';
import { getRoleHome } from '@/lib/utils/roleRedirect';

const NAV_LINKS = [
  { label: 'Explore', href: 'browse'   },
  { label: 'Artists', href: 'artists'  },
  { label: 'Genres',  href: 'genres'   },
];

function UserMenu({ locale }: { locale: string }) {
  const router = useRouter();
  const { user, hasRole, clearUser } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push(`/${locale}/login`);
  };

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={`/${locale}/login`}
          style={{
            padding: '7px 18px', fontSize: '0.75rem', letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--charcoal)', textDecoration: 'none',
            fontWeight: 500, border: '1px solid rgba(13,13,13,0.2)', borderRadius: 20,
            transition: 'border-color 0.2s, color 0.2s cubic-bezier(0.16,1,0.3,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold-dim)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--charcoal)'; e.currentTarget.style.borderColor = 'rgba(13,13,13,0.2)'; }}
        >
          Sign In
        </Link>
        <Link
          href={`/${locale}/register`}
          className="btn-gold"
          style={{
            padding: '7px 22px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0d0d0d', textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Start Free
        </Link>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '5px 10px 5px 5px', borderRadius: 24,
          background: open ? 'rgba(13,13,13,0.1)' : 'rgba(13,13,13,0.05)',
          border: '1px solid rgba(13,13,13,0.12)',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(13,13,13,0.1)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(13,13,13,0.05)'; }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(232,184,75,0.2)', border: '1px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.62rem', fontWeight: 700, color: 'var(--gold-dim)',
          }}>
            {initials}
          </div>
        )}
        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--charcoal)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 230, borderRadius: 10, overflow: 'hidden',
          background: '#181818', border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          zIndex: 200,
          animation: 'fadeUp 0.2s ease both',
        }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ivory)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
              <p style={{ fontSize: '0.67rem', color: 'var(--muted-text)' }}>
                {user.roles?.includes('PREMIUM' as Role) ? '✦ Premium' : 'Free Plan'}
              </p>
            </div>
          </div>

          <div style={{ padding: '6px 0' }}>
            {([
              { href: getRoleHome(user?.roles, locale), label: 'Go to App',      icon: <LayoutDashboard size={13} /> },
              { href: `/${locale}/profile`,             label: 'Profile',         icon: <User size={13} /> },
              ...(hasRole(Role.ARTIST) ? [{ href: `/${locale}/artist/profile`, label: 'Artist Studio', icon: <Music2 size={13} /> }] : []),
              { href: `/${locale}/profile/password`,    label: 'Change Password', icon: <KeyRound size={13} /> },
            ] as { href: string; label: string; icon: React.ReactNode }[]).map(({ href, label, icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', fontSize: '0.8rem',
                color: 'var(--muted-text)', textDecoration: 'none', fontFamily: 'var(--font-body)',
                transition: 'color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'none'; }}
              >
                {icon}{label}
              </Link>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          <div style={{ padding: '6px 0' }}>
            <button type="button" onClick={handleLogout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 16px', fontSize: '0.8rem',
              background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
              color: 'var(--muted-text)', fontFamily: 'var(--font-body)',
              transition: 'color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e07070'; e.currentTarget.style.background = 'rgba(220,80,80,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'none'; }}
            >
              <LogOut size={13} />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicHeader({ locale }: { locale: string }) {
  const pathname = usePathname();

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(20px, 5vw, 72px)',
      background: 'var(--ivory)',
      borderBottom: '2px solid var(--gold)',
      boxShadow: '0 2px 0 var(--gold), 0 4px 32px rgba(232,184,75,0.25), 0 1px 80px rgba(232,184,75,0.10)',
    }}>

      {/* Logo */}
      <Link href={`/${locale}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(232,184,75,0.4)',
          animation: 'ringPulse 3s ease-in-out infinite',
        }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.18rem', fontWeight: 600, color: 'var(--charcoal)', letterSpacing: '0.01em' }}>
          My Music
        </span>
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname.includes(`/${href}`);
          return (
            <Link
              key={label}
              href={`/${locale}/${href}`}
              style={{
                fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                color: isActive ? 'var(--gold-dim)' : 'var(--charcoal)',
                textDecoration: 'none', fontWeight: isActive ? 700 : 500,
                position: 'relative', paddingBottom: 2,
                transition: 'color 0.2s cubic-bezier(0.16,1,0.3,1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isActive ? 'var(--gold-dim)' : 'var(--charcoal)'; }}
            >
              {label}
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: -2, left: 0, right: 0,
                  height: 2, background: 'var(--gold)',
                  borderRadius: 1,
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <UserMenu locale={locale} />
    </header>
  );
}
