'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, User, LogOut, Music2, Shield, KeyRound, LayoutDashboard, Crown } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/lib/api/auth.api';
import { Role } from '@mymusic/types';
import { getRoleHome } from '@/lib/utils/roleRedirect';
import NotificationBell from '@/components/layout/NotificationBell';

export default function TopBar() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasRole, clearUser } = useAuthStore();
  const isExplorePage = pathname === `/${locale}/browse` || pathname.startsWith(`/${locale}/browse/`);

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<Element | null>(null);

  // Detect scroll on the scrollable main element to add bg opacity
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    mainRef.current = main;
    const onScroll = () => setScrolled(main.scrollTop > 16);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
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
  const isAdmin  = hasRole(Role.ADMIN);

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 56,
      background: scrolled ? 'rgba(8,8,8,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
      transition: 'background 0.25s, backdrop-filter 0.25s, border-color 0.25s',
    }}>

      {/* ── Left: nav arrows + Explore link ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {[
          { icon: <ChevronLeft size={16} />, action: () => router.back() },
          { icon: <ChevronRight size={16} />, action: () => router.forward() },
        ].map(({ icon, action }, i) => (
          <button
            key={i}
            type="button"
            onClick={action}
            style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--muted-text)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'var(--ivory)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--muted-text)'; }}
          >
            {icon}
          </button>
        ))}

        {/* Explore pill — Spotify-style top-nav link */}
        <Link
          href={`/${locale}/browse`}
          style={{
            marginLeft: 8,
            padding: '6px 16px',
            borderRadius: 20,
            background: isExplorePage ? 'var(--ivory)' : 'rgba(255,255,255,0.08)',
            color: isExplorePage ? 'var(--charcoal)' : 'var(--ivory)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            letterSpacing: '0.01em',
            textDecoration: 'none',
            transition: 'background 0.18s, color 0.18s',
          }}
          onMouseEnter={e => {
            if (!isExplorePage) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)';
            }
          }}
          onMouseLeave={e => {
            if (!isExplorePage) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            }
          }}
        >
          Explore
        </Link>
      </div>

      {/* ── Right: notification bell + user area ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user && <NotificationBell />}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        {user ? (
          <>
            {/* Avatar + name button */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '5px 6px 5px 5px', borderRadius: 24,
                background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            >
              {/* Avatar */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(232,184,75,0.15)',
                  border: '1px solid rgba(232,184,75,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.62rem', fontWeight: 600, color: 'var(--gold)',
                }}>
                  {initials}
                </div>
              )}

              {/* Name */}
              <span style={{
                fontSize: '0.8rem', fontWeight: 500, color: 'var(--ivory)',
                maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                paddingRight: 2,
              }}>
                {user.name}
              </span>

              {/* Caret */}
              <ChevronRight size={12} style={{
                color: 'var(--muted-text)', marginRight: 2, flexShrink: 0,
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }} />
            </button>

            {/* Dropdown */}
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
                {/* User info header */}
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ivory)', marginBottom: 2 }}>
                    {user.name}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)' }}>
                    {user.roles?.includes('PREMIUM') ? '✦ Premium' : 'Free Plan'}
                  </p>
                </div>

                {/* Menu items */}
                <div style={{ padding: '6px 0' }}>
                  <DropItem href={getRoleHome(user?.roles, locale)} icon={<LayoutDashboard size={13} />} label="Home"          onClick={() => setOpen(false)} />
                  <DropItem href={`/${locale}/profile`}          icon={<User size={13} />}            label="Account"         onClick={() => setOpen(false)} />
                  <DropItem href={`/${locale}/profile/premium`}  icon={<Crown size={13} />}           label="Premium"         onClick={() => setOpen(false)} />
                  {isArtist && (
                    <DropItem href={`/${locale}/artist/profile`} icon={<Music2 size={13} />}          label="Artist Studio"   onClick={() => setOpen(false)} />
                  )}
                  {isAdmin && (
                    <DropItem href={`/${locale}/admin`}          icon={<Shield size={13} />}          label="Admin Portal"    onClick={() => setOpen(false)} />
                  )}
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0' }} />

                {/* Logout */}
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
          /* Not logged in */
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link
              href={`/${locale}/login`}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: '0.78rem',
                fontFamily: 'var(--font-body)', fontWeight: 500, letterSpacing: '0.03em',
                color: 'var(--ivory)', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--ivory)'; }}
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

// ── Dropdown link item ────────────────────────────────────────────────────────
function DropItem({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick: () => void }) {
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
