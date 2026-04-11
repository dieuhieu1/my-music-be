'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';

// Admin role guard — redirects non-ADMINs to /browse
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasRole } = useAuthStore();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  useEffect(() => {
    if (!isLoading && !hasRole(Role.ADMIN)) {
      router.replace(`/${locale}/browse`);
    }
  }, [user, isLoading, hasRole, router, locale]);

  if (isLoading || !hasRole(Role.ADMIN)) return null;

  return <>{children}</>;
}
