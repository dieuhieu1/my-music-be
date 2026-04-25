'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { recommendationsApi, type SongRecommendationDto, type ContextHeaders } from '@/lib/api/recommendations.api';
import { useAuthStore } from '@/store/useAuthStore';

function buildCtx(): ContextHeaders {
  if (typeof window === 'undefined') return {};
  return {
    localHour: new Date().getHours(),
    deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
    // X-Location-Context: omit in V1 (TODO: explicit user action)
  };
}

export function useRecommendations(initialSize = 20) {
  const { user } = useAuthStore();
  const [size, setSize] = useState(initialSize);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('30d');

  const query = useQuery({
    queryKey: ['recommendations', timeRange, size] as const,
    queryFn: () =>
      recommendationsApi
        .getRecommendations({ size, timeRange }, buildCtx())
        .then((res) => (res.data?.data ?? res.data) as SongRecommendationDto[]),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const loadMore = () => setSize((prev) => Math.min(prev + 20, 50));

  return {
    songs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    timeRange,
    setTimeRange,
    loadMore,
    hasMore: size < 50,
  };
}
