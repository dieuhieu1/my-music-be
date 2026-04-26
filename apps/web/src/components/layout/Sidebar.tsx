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
  Disc,
  Tags,
  ClipboardList,
  LayoutDashboard,
  ListOrdered,
  Download,
} from 'lucide-react';

// ── Nav item shape ─────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  Icon: React.ElementType;
  exact?: boolean;
}

const listenerItems: NavItem[] = [
  { href: '/browse',          label: 'Explore',         Icon: Compass      },
  { href: '/queue',           label: 'Queue',           Icon: ListOrdered  },
  { href: '/playlists',       label: 'Playlists',       Icon: ListMusic    },
  { href: '/playlists/liked', label: 'Liked Songs',     Icon: Heart        },
  { href: '/playlists/saved', label: 'Saved',           Icon: Bookmark     },
  { href: '/feed',            label: 'Activity Feed',   Icon: Activity     },
  { href: '/downloads',       label: 'Downloads',       Icon: Download     },
];

const artistItems: NavItem[] = [
  { href: '/artist/profile',   label: 'Artist Profile', Icon: Mic2      },
  { href: '/artist/songs',     label: 'My Songs',      Icon: Library   },
  { href: '/artist/upload',    label: 'Upload',        Icon: Upload    },
  { href: '/artist/albums',    label: 'My Albums',     Icon: Disc      },
  { href: '/artist/analytics', label: 'Analytics',     Icon: BarChart2 },
  { href: '/artist/drops',     label: 'Live Drops',    Icon: Radio     },
];

const adminItems: NavItem[] = [
  { href: '/admin',         label: 'Dashboard',  Icon: LayoutDashboard, exact: true },
  { href: '/admin/songs',   label: 'Song Queue', Icon: Library          },
  { href: '/admin/genres',  label: 'Genres',     Icon: Tags             },
  { href: '/admin/audit',   label: 'Audit Log',  Icon: ClipboardList    },
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
  const { hasRole } = useAuthStore();
  const isArtist = hasRole(Role.ARTIST);
  const isAdmin  = hasRole(Role.ADMIN);

  const active = (href: string, exact = false) =>
    exact
      ? pathname === `/${locale}${href}`
      : pathname === `/${locale}${href}` || pathname.startsWith(`/${locale}${href}/`);

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
            {adminItems.map((item, i) => (
              <div key={item.href} style={{
                animation: `slideNav 0.35s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: `${(i + listenerItems.length + artistItems.length) * 0.04}s`,
              }}>
                <NavLink
                  {...item}
                  href={`/${locale}${item.href}`}
                  active={active(item.href, item.exact)}
                />
              </div>
            ))}
          </>
        )}
      </nav>

    </aside>
  );
}
