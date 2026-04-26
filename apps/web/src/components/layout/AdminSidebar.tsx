'use client';

import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Library, Tags, Users,
  ClipboardList, CreditCard, Flag, LogOut, Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/lib/api/auth.api';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ElementType;
  exact?: boolean;
}

const items: NavItem[] = [
  { href: '/admin',          label: 'Dashboard',   Icon: LayoutDashboard, exact: true },
  { href: '/admin/songs',    label: 'Song Queue',  Icon: Library          },
  { href: '/admin/users',    label: 'Users',       Icon: Users            },
  { href: '/admin/genres',   label: 'Genres',      Icon: Tags             },
  { href: '/admin/payments', label: 'Payments',    Icon: CreditCard       },
  { href: '/admin/reports',  label: 'Reports',     Icon: Flag             },
  { href: '/admin/audit',    label: 'Audit Log',   Icon: ClipboardList    },
];

function NavLink({ href, label, Icon, exact, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px 9px 20px',
        borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
        background: active ? 'rgba(232,184,75,0.06)' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--muted-text)',
        fontSize: '0.82rem', fontFamily: 'var(--font-body)',
        fontWeight: active ? 500 : 400, letterSpacing: '0.01em',
        textDecoration: 'none',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'var(--ivory)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
      {label}
    </Link>
  );
}

export default function AdminSidebar() {
  const { locale } = useParams<{ locale: string }>();
  const pathname   = usePathname();
  const router     = useRouter();
  const { clearUser } = useAuthStore();

  const active = (href: string, exact = false) =>
    exact
      ? pathname === `/${locale}${href}`
      : pathname === `/${locale}${href}` || pathname.startsWith(`/${locale}${href}/`);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push(`/${locale}/admin-login`);
  };

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      backgroundColor: '#060606',
      borderRight: '1px solid #111',
    }}>

      {/* Branding */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid #111',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          background: 'rgba(232,184,75,0.1)',
          border: '1px solid rgba(232,184,75,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={15} color="var(--gold)" />
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ivory)', letterSpacing: '0.02em' }}>
            Admin Portal
          </p>
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            My Music
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        <p style={{
          padding: '10px 20px 6px',
          fontSize: '0.58rem', letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(232,184,75,0.25)',
          fontFamily: 'var(--font-body)', fontWeight: 600,
        }}>
          Management
        </p>
        {items.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            href={`/${locale}${item.href}`}
            active={active(item.href, item.exact)}
          />
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 0', borderTop: '1px solid #111' }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 20px', background: 'none', border: 'none',
            color: 'var(--muted-text)', fontSize: '0.82rem',
            fontFamily: 'var(--font-body)', letterSpacing: '0.01em',
            cursor: 'pointer', textAlign: 'left',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e07070';
            e.currentTarget.style.background = 'rgba(220,80,80,0.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted-text)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
