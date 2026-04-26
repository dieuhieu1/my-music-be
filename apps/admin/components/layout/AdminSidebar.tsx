'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Music2,
  Users,
  Tag,
  Flag,
  ClipboardList,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin.api';
import { useAuthStore } from '@/store/auth.store';
import { clearAdminToken } from '@/lib/utils/cookies';
import { CountBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/songs', label: 'Songs', icon: Music2, badge: 'pendingSongs' },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/genres', label: 'Genres', icon: Tag },
  { href: '/reports', label: 'Reports', icon: Flag, badge: 'openReports' },
  { href: '/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/payments', label: 'Payments', icon: CreditCard },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { adminUser, clearAdminUser } = useAuthStore();

  const { data: songCounts } = useQuery({
    queryKey: ['admin', 'songs', 'pending-count'],
    queryFn: async () => {
      const res = await adminApi.getSongs({ status: 'PENDING', size: 1 });
      return res.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: reportCounts } = useQuery({
    queryKey: ['admin', 'reports', 'open-count'],
    queryFn: async () => {
      const res = await adminApi.getReports({ status: 'PENDING', size: 1 });
      return res.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const badges: Record<string, number> = {
    pendingSongs: songCounts?.totalItems ?? 0,
    openReports: reportCounts?.totalItems ?? 0,
  };

  function handleSignOut() {
    clearAdminToken();
    clearAdminUser();
    router.push('/login');
  }

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}
        >
          MyMusic{' '}
          <span style={{ color: '#2563EB' }}>Admin</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href);
          const count = badge ? badges[badge] : 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                  : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]',
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className="flex-1">{label}</span>
              {count > 0 && <CountBadge count={count} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      >
        {adminUser && (
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {adminUser.name}
            </p>
            <p
              style={{
                fontSize: 11,
                color: '#6B7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {adminUser.email}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
