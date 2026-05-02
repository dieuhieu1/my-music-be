'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, User, LogOut, Music2,
  LayoutDashboard, Crown,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/lib/api/auth.api';
import { Role } from '@mymusic/types';
import { getRoleHome } from '@/lib/utils/roleRedirect';
import NotificationBell from '@/components/layout/NotificationBell';

const NAV_LINKS = [
  { label: 'Explore', href: 'browse'   },
  { label: 'Artists', href: 'artists'  },
  { label: 'Genres',  href: 'genres'   },
];

export default function TopBar() {
  const { locale } = useParams<{ locale: string }>();
  const router   = useRouter();
  const pathname = usePathname();
  const { user, hasRole, clearUser } = useAuthStore();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const isArtist = hasRole(Role.ARTIST);

  return (
    <div style={{
      position: 'relative',
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 clamp(20px, 5vw, 72px)',
      height: 68,
      background: 'var(--ivory)',
      borderBottom: '2px solid var(--gold)',
      boxShadow: '0 2px 0 var(--gold), 0 4px 32px rgba(232,184,75,0.25), 0 1px 80px rgba(232,184,75,0.10)',
    }}>

      {/* ── Left: Logo ──────────────────────────────────────────────────────── */}
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

      {/* ── Center: Nav ─────────────────────────────────────────────────────── */}
      <nav style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname === `/${locale}/${href}` || pathname.startsWith(`/${locale}/${href}/`);
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

      {/* ── Right: notification + user ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user && <NotificationBell />}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 6px 5px 5px', borderRadius: 24,
                  background: open ? 'rgba(13,13,13,0.1)' : 'rgba(13,13,13,0.05)',
                  border: '1px solid rgba(13,13,13,0.12)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(13,13,13,0.1)'; }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(13,13,13,0.05)'; }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(232,184,75,0.2)',
                    border: '1px solid var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.62rem', fontWeight: 700, color: 'var(--gold-dim)',
                  }}>
                    {initials}
                  </div>
                )}
                <span style={{
                  fontSize: '0.8rem', fontWeight: 500, color: 'var(--charcoal)',
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  paddingRight: 2,
                }}>
                  {user.name}
                </span>
                <ChevronRight size={12} style={{
                  color: 'var(--charcoal)', marginRight: 2, flexShrink: 0,
                  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }} />
              </button>

              {open && (
                <div
                  className="anim-fade-up"
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 220, borderRadius: 8, overflow: 'hidden',
                    background: '#181818', border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ivory)', marginBottom: 2 }}>
                      {user.name}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)' }}>
                      {user.roles?.includes('PREMIUM') ? '✦ Premium' : 'Free Plan'}
                    </p>
                  </div>

                  <div style={{ padding: '6px 0' }}>
                    <DropItem href={getRoleHome(user?.roles, locale)} icon={<LayoutDashboard size={13} />} label="Home"          onClick={() => setOpen(false)} />
                    <DropItem href={`/${locale}/profile`}             icon={<User size={13} />}            label="Account"        onClick={() => setOpen(false)} />
                    <DropItem href={`/${locale}/profile/premium`}     icon={<Crown size={13} />}           label="Premium"        onClick={() => setOpen(false)} />
                    {isArtist && (
                      <DropItem href={`/${locale}/artist/profile`}   icon={<Music2 size={13} />}          label="Artist Studio"  onClick={() => setOpen(false)} />
                    )}
                  </div>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                  <div style={{ padding: '6px 0' }}>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', background: 'none', border: 'none',
                        color: 'var(--muted-text)', fontSize: '0.8rem', fontFamily: 'var(--font-body)',
                        cursor: 'pointer', textAlign: 'left', letterSpacing: '0.01em',
                        transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#e07070'; e.currentTarget.style.background = 'rgba(220,80,80,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'none'; }}
                    >
                      <LogOut size={13} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link
                href={`/${locale}/login`}
                style={{
                  padding: '7px 18px', borderRadius: 20, fontSize: '0.78rem',
                  fontFamily: 'var(--font-body)', fontWeight: 500, letterSpacing: '0.03em',
                  color: 'var(--charcoal)', textDecoration: 'none',
                  border: '1px solid rgba(13,13,13,0.2)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold-dim)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(13,13,13,0.2)'; e.currentTarget.style.color = 'var(--charcoal)'; }}
              >
                Log in
              </Link>
              <Link
                href={`/${locale}/register`}
                className="btn-gold"
                style={{
                  padding: '7px 18px', borderRadius: 20, fontSize: '0.78rem',
                  fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '0.03em',
                  color: '#0d0d0d', textDecoration: 'none',
                }}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DropItem({ href, icon, label, onClick }: {
  href: string; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', color: 'var(--muted-text)', textDecoration: 'none',
        fontSize: '0.8rem', fontFamily: 'var(--font-body)', letterSpacing: '0.01em',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'none'; }}
    >
      {icon}
      {label}
    </Link>
  );
}
