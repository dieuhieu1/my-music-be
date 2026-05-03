'use client';

import { useParams, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import PlayerBar from '@/components/layout/PlayerBar';
import TopBar from '@/components/layout/TopBar';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminTopBar from '@/components/layout/AdminTopBar';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>();
  const pathname   = usePathname();

  if (pathname.startsWith(`/${locale}/admin`)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', backgroundColor: '#080808',
      }}>
        <AdminTopBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <AdminSidebar />
          <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#080808' }}>
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-24">
          {children}
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}
