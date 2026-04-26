'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';
import { usersApi } from '@/lib/api/users.api';

// Hydrates the auth store on app load by fetching /users/me.
// Also redirects to /onboarding for users who haven't completed it yet.
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    usersApi
      .getMe()
      .then((res) => {
        const user = res.data.data;
        setUser(user);
        const roles: string[] = user?.roles ?? [];
        const isRegularUser = !roles.includes('ARTIST') && !roles.includes('ADMIN');
        if (isRegularUser && !user?.onboardingCompleted && !pathname.includes('/onboarding')) {
          router.replace(`/${locale}/onboarding`);
        }
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
