'use client';

import { useQuery } from '@tanstack/react-query';
import {
  recommendationsApi,
  type SongRecommendationDto,
  type MoodType,
  type ContextHeaders,
} from '@/lib/api/recommendations.api';

function buildCtx(): ContextHeaders {
  if (typeof window === 'undefined') return {};
  return {
    localHour: new Date().getHours(),
    deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
  };
}

interface UseMoodRecsResult {
  songs: SongRecommendationDto[];
  resolvedMood: MoodType | null;
  inferred: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useMoodRecs(mood?: MoodType, size = 20): UseMoodRecsResult {
  const query = useQuery({
    queryKey: ['recommendations', 'mood', mood ?? 'inferred', size] as const,
    queryFn: async () => {
      const res = await recommendationsApi.getMoodRecommendations(
        { mood, size },
        buildCtx(),
      );
      return res.data?.data ?? res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const data = query.data as { mood: MoodType | null; inferred: boolean; songs: SongRecommendationDto[] } | undefined;

  return {
    songs: data?.songs ?? [],
    resolvedMood: data?.mood ?? null,
    inferred: data?.inferred ?? false,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
