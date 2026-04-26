'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/songs': 'Song Approval Queue',
  '/users': 'User Management',
  '/genres': 'Genre Management',
  '/reports': 'Content Reports',
  '/audit': 'Audit Log',
  '/payments': 'Payments',
};

export function AdminHeader() {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(([key]) =>
      key === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(key),
    )?.[1] ?? 'Admin';

  return (
    <header
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#111827',
          margin: 0,
        }}
      >
        {title}
      </h1>
    </header>
  );
}
