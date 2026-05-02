'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Music, Tag, Users, Flag,
  TrendingUp, CreditCard, ScrollText, Star,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { NotificationBell } from '@/components/ui/NotificationBell';

// ── Page config ────────────────────────────────────────────────────────────

interface PageConfig {
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
}

const PAGE_CONFIG: Record<string, PageConfig> = {
  '/dashboard': { title: 'Dashboard',        subtitle: 'Overview & analytics',   Icon: LayoutDashboard },
  '/songs':     { title: 'Songs',            subtitle: 'Content moderation',     Icon: Music },
  '/artists':   { title: 'Official Artists', subtitle: 'Artist management',      Icon: Star },
  '/genres':    { title: 'Genres',           subtitle: 'Taxonomy management',    Icon: Tag },
  '/users':     { title: 'Users',            subtitle: 'Account management',     Icon: Users },
  '/reports':   { title: 'Reports',          subtitle: 'Community moderation',   Icon: Flag },
  '/audit':     { title: 'Audit Log',        subtitle: 'Activity history',       Icon: ScrollText },
  '/payments':  { title: 'Payments',         subtitle: 'Transaction records',    Icon: CreditCard },
  '/revenue':   { title: 'Revenue',          subtitle: 'Financial analytics',    Icon: TrendingUp },
};

// ── AdminHeader ────────────────────────────────────────────────────────────

export function AdminHeader() {
  const pathname   = usePathname() ?? '';
  const { adminUser } = useAuthStore();

  const config = Object.entries(PAGE_CONFIG).find(([key]) =>
    key === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(key),
  )?.[1] ?? { title: 'Admin', Icon: LayoutDashboard };

  const { title, subtitle, Icon } = config;

  const initials = (adminUser?.name ?? adminUser?.email ?? 'AD').slice(0, 2).toUpperCase();

  return (
    <header style={{
      position: 'fixed', top: 0, left: 240, right: 0, height: 64,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)', zIndex: 30,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
    }}>

      {/* Left: page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={20} color="var(--accent)" />
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.2 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: bell + divider + avatar */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <NotificationBell />

        <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 'var(--radius)',
            border: '1px solid transparent', background: 'transparent',
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-subtle)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '9999px', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: 'white', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {adminUser?.email ?? ''}
          </span>
        </button>
      </div>
    </header>
  );
}
