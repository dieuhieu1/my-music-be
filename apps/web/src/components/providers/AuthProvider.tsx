'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { usersApi } from '@/lib/api/users.api';

// Hydrates the auth store on app load by fetching /users/me.
// Any 401 is silently ignored — axios interceptor handles the redirect.
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    usersApi
      .getMe()
      .then((res) => setUser(res.data.data))
      .catch(() => setLoading(false));
  }, [setUser, setLoading]);

  return <>{children}</>;
}
