'use client';

import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <AdminSidebar />
      <AdminHeader />
      <div style={{ marginLeft: 240, paddingTop: 64, minHeight: '100vh', background: 'var(--bg)' }}>
        {/* key forces remount on navigation, retriggering the fade animation */}
        <main
          key={pathname}
          className="animate-fade-in-up"
          style={{ padding: '24px 32px' }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
