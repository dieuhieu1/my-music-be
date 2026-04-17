'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';
import {
  Compass,
  ListMusic,
  Heart,
  Bookmark,
  Activity,
  Mic2,
  Library,
  Upload,
  BarChart2,
  Radio,
  Shield,
  UserCircle2,
  LogOut,
  Disc,
} from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useRouter } from 'next/navigation';

// ── Nav item shape ─────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  Icon: React.ElementType;
}

const listenerItems: NavItem[] = [
  { href: '/browse',          label: 'Browse',          Icon: Compass    },
  { href: '/playlists',       label: 'Playlists',       Icon: ListMusic  },
  { href: '/playlists/liked', label: 'Liked Songs',     Icon: Heart      },
  { href: '/playlists/saved', label: 'Saved',           Icon: Bookmark   },
  { href: '/feed',            label: 'Activity Feed',   Icon: Activity   },
];

const artistItems: NavItem[] = [
  { href: '/artist/profile',   label: 'My Profile',    Icon: Mic2      },
  { href: '/artist/songs',     label: 'My Songs',      Icon: Library   },
  { href: '/artist/upload',    label: 'Upload',        Icon: Upload    },
  { href: '/artist/albums',    label: 'My Albums',     Icon: Disc      },
  { href: '/artist/analytics', label: 'Analytics',     Icon: BarChart2 },
  { href: '/artist/drops',     label: 'Live Drops',    Icon: Radio     },
];

// ── Single nav item ────────────────────────────────────────────────────────
function NavLink({ href, label, Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px 8px 16px',
        marginLeft: active ? 0 : 0,
        borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
        background: active ? 'rgba(232,184,75,0.05)' : 'transparent',
        borderRadius: '0 4px 4px 0',
        color: active ? 'var(--gold)' : 'var(--muted-text)',
        fontSize: '0.82rem',
        fontFamily: 'var(--font-body)',
        fontWeight: active ? 500 : 400,
        letterSpacing: '0.01em',
        textDecoration: 'none',
        transition: 'color 0.18s, background 0.18s, border-color 0.18s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'var(--ivory)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
      {label}
    </Link>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: '14px 16px 6px',
      fontSize: '0.6rem',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'rgba(232,184,75,0.35)',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
    }}>
      {label}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasRole, clearUser } = useAuthStore();
  const isArtist = hasRole(Role.ARTIST);
  const isAdmin  = hasRole(Role.ADMIN);

  const active = (href: string) =>
    pathname === `/${locale}${href}` || pathname.startsWith(`/${locale}${href}/`);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push(`/${locale}/login`);
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#080808',
        borderRight: '1px solid #141414',
        overflow: 'hidden',
      }}
    >
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <Link
        href={`/${locale}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '20px 16px 16px',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 14px rgba(232,184,75,0.35)',
        }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z"
              stroke="#0d0d0d" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.05rem',
          fontWeight: 600,
          color: 'var(--ivory)',
          letterSpacing: '0.01em',
        }}>
          My Music
        </span>
      </Link>

      {/* Thin divider */}
      <div style={{ height: 1, background: '#141414', margin: '0 16px', flexShrink: 0 }} />

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <SectionHeader label="Library" />
        {listenerItems.map((item, i) => (
          <div key={item.href} style={{
            animation: `slideNav 0.35s cubic-bezier(0.16,1,0.3,1) both`,
            animationDelay: `${i * 0.04}s`,
          }}>
            <NavLink
              {...item}
              href={`/${locale}${item.href}`}
              active={active(item.href)}
            />
          </div>
        ))}

        {(isArtist || isAdmin) && (
          <>
            <div style={{ height: 1, background: '#141414', margin: '8px 16px' }} />
            <SectionHeader label="Creator" />
            {artistItems.map((item, i) => (
              <div key={item.href} style={{
                animation: `slideNav 0.35s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: `${(i + listenerItems.length) * 0.04}s`,
              }}>
                <NavLink
                  {...item}
                  href={`/${locale}${item.href}`}
                  active={active(item.href)}
                />
              </div>
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div style={{ height: 1, background: '#141414', margin: '8px 16px' }} />
            <SectionHeader label="Admin" />
            <NavLink
              href={`/${locale}/admin`}
              label="Dashboard"
              Icon={Shield}
              active={active('/admin')}
            />
          </>
        )}
      </nav>

      {/* ── User mini-profile ──────────────────────────────────────────── */}
      {user && (
        <>
          <div style={{ height: 1, background: '#141414', flexShrink: 0 }} />
          <div style={{ padding: '10px 12px', flexShrink: 0 }}>
            <Link
              href={`/${locale}/profile`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px',
                borderRadius: 6,
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              {/* Avatar */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                    border: '1px solid rgba(232,184,75,0.25)',
                  }}
                />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(232,184,75,0.12)',
                  border: '1px solid rgba(232,184,75,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: 'var(--gold)',
                  letterSpacing: '0.05em',
                }}>
                  {initials}
                </div>
              )}

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: 'var(--ivory)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {user.name}
                </p>
                <p style={{
                  fontSize: '0.63rem',
                  color: 'var(--muted-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.roles?.includes('PREMIUM') ? '✦ Premium' : 'Listener'}
                </p>
              </div>
              <UserCircle2 size={13} style={{ color: 'var(--muted-text)', flexShrink: 0, opacity: 0.5 }} />
            </Link>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px',
                background: 'transparent', border: 'none',
                color: 'var(--muted-text)', fontSize: '0.75rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer', borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#e07070')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted-text)')}
            >
              <LogOut size={12} style={{ flexShrink: 0 }} />
              Sign out
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
