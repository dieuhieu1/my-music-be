'use client';

import { useEffect, useState, useCallback } from 'react';
import { notificationsApi } from '@/lib/api/notifications.api';
import { useAuthStore } from '@/store/useAuthStore';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuthStore();

  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      const data = res.data?.data ?? res.data;
      setUnreadCount(data?.count ?? 0);
    } catch {
      // silent — bell badge degrades gracefully
    }
  }, [user]);

  useEffect(() => {
    fetchCount();
    if (!user) return;
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount, user]);

  return { unreadCount, refetch: fetchCount };
}
