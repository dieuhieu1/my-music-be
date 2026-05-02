'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Music, Tag, Users, Flag,
  TrendingUp, CreditCard, ScrollText, Music2, LogOut, Star,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type Paginated, type AdminSong, type Report, type GenreSuggestion } from '@/lib/api/admin.api';
import { useAuthStore } from '@/store/auth.store';
import { clearAdminToken } from '@/lib/utils/cookies';
import { BADGE_QUERY_KEYS } from '@/components/ui/NotificationBell';

// ── Nav structure ──────────────────────────────────────────────────────────

interface NavItemDef {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: 'songs' | 'reports' | 'genres';
}

interface NavGroup {
  label: string;
  items: NavItemDef[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: 'Songs',            href: '/songs',   icon: Music, badge: 'songs' },
      { label: 'Official Artists', href: '/artists', icon: Star },
      { label: 'Genres',           href: '/genres',  icon: Tag,   badge: 'genres' },
    ],
  },
  {
    label: 'COMMUNITY',
    items: [
      { label: 'Users',   href: '/users',   icon: Users },
      { label: 'Reports', href: '/reports', icon: Flag, badge: 'reports' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Revenue',   href: '/revenue',   icon: TrendingUp },
      { label: 'Payments',  href: '/payments',  icon: CreditCard },
      { label: 'Audit Log', href: '/audit',     icon: ScrollText },
    ],
  },
];

// ── NavItem (local hover state needed for icon color split) ────────────────

function NavItem({ label, href, icon: Icon, count, active }: {
  label: string;
  href: string;
  icon: LucideIcon;
  count: number;
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '1px 8px',
        padding: `9px 12px 9px ${active ? 9 : 12}px`,
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
        fontSize: 14, fontWeight: active ? 600 : 500,
        color: lit ? 'var(--accent)' : 'var(--text-muted)',
        background: lit ? 'var(--accent-light)' : 'transparent',
        textDecoration: 'none', transition: 'all 150ms',
      }}
    >
      <Icon
        size={18}
        color={lit ? 'var(--accent)' : 'var(--text-faint)'}
        style={{ flexShrink: 0, transition: 'color 150ms' }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && (
        <span style={{
          background: 'var(--warning)', color: 'white',
          fontSize: 10, fontWeight: 700,
          padding: '1px 7px', borderRadius: 'var(--radius-full)',
          minWidth: 18, textAlign: 'center',
          animation: 'pulse-badge 2s infinite',
        }}>
          {count}
        </span>
      )}
    </a>
  );
}

// ── AdminSidebar ───────────────────────────────────────────────────────────

export function AdminSidebar() {
  const pathname  = usePathname() ?? '';
  const router    = useRouter();
  const { adminUser, clearAdminUser } = useAuthStore();

  // Share query keys with NotificationBell — same cache entry, no double-fetch
  const { data: pendingSongsCount } = useQuery<Paginated<AdminSong>, Error, number>({
    queryKey: BADGE_QUERY_KEYS.pendingSongs,
    queryFn: () => adminApi.getSongs({ status: 'PENDING', page: 1, size: 1 }).then(r => r.data),
    select: (data) => data.totalItems,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pendingReportsCount } = useQuery<Paginated<Report>, Error, number>({
    queryKey: BADGE_QUERY_KEYS.pendingReports,
    queryFn: () => adminApi.getReports({ status: 'PENDING', page: 1, size: 1 }).then(r => r.data),
    select: (data) => data.totalItems,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pendingGenresCount } = useQuery<GenreSuggestion[], Error, number>({
    queryKey: BADGE_QUERY_KEYS.genreSuggestions,
    queryFn: () => adminApi.getGenreSuggestions().then(r => r.data),
    select: (data) => data.filter(s => s.status === 'PENDING').length,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const badges: Record<string, number> = {
    songs:   pendingSongsCount   ?? 0,
    reports: pendingReportsCount ?? 0,
    genres:  pendingGenresCount  ?? 0,
  };

  function signOut() {
    clearAdminToken();
    clearAdminUser();
    router.push('/login');
  }

  const initials = (adminUser?.name ?? 'AD').slice(0, 2).toUpperCase();

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      boxShadow: 'var(--shadow-md)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{
        height: 64, flexShrink: 0,
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 10,
      }}>
        <Music2 size={24} color="white" />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
          MyMusic Admin
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <p style={{
              padding: '8px 16px 4px',
              fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-faint)', margin: 0,
              marginTop: gi === 0 ? 0 : 8,
            }}>
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;

              return (
                <NavItem
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  count={count}
                  active={active}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* Admin info card */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 12, flexShrink: 0 }}>
        <div style={{
          background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 12px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '9999px', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: 'white', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {adminUser?.name ?? 'Admin'}
            </p>
            <p style={{
              fontSize: 11, color: 'var(--text-faint)',
              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {adminUser?.email ?? ''}
            </p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 4, flexShrink: 0,
              color: 'var(--text-faint)', transition: 'color 150ms',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
