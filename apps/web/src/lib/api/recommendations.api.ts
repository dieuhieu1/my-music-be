import apiClient from './axios';

export type MoodType = 'HAPPY' | 'SAD' | 'FOCUS' | 'CHILL' | 'WORKOUT';

export interface SongRecommendationDto {
  id: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  duration: number;
  genres: string[];
  bpm: number | null;
  camelotKey: string | null;
  totalPlays: number;
  createdAt: string;
}

export interface MoodRecommendationResponse {
  mood: MoodType | null;
  inferred: boolean;
  songs: SongRecommendationDto[];
}

export interface RecommendationParams {
  size?: number;
  timeRange?: '7d' | '30d';
}

export interface MoodRecommendationParams extends RecommendationParams {
  mood?: MoodType;
}

export interface ContextHeaders {
  deviceType?: 'mobile' | 'desktop';
  localHour?: number;
  locationContext?: 'gym' | 'commute';
}

function buildContextHeaders(ctx: ContextHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ctx.deviceType) headers['X-Device-Type'] = ctx.deviceType;
  if (ctx.localHour !== undefined) headers['X-Local-Hour'] = String(ctx.localHour);
  if (ctx.locationContext) headers['X-Location-Context'] = ctx.locationContext;
  return headers;
}

export const recommendationsApi = {
  getRecommendations: (params: RecommendationParams = {}, ctx: ContextHeaders = {}) =>
    apiClient.get<{ data: SongRecommendationDto[] }>('/recommendations', {
      params,
      headers: buildContextHeaders(ctx),
    }),

  getMoodRecommendations: (params: MoodRecommendationParams = {}, ctx: ContextHeaders = {}) =>
    apiClient.get<{ data: MoodRecommendationResponse }>('/recommendations/mood', {
      params,
      headers: buildContextHeaders(ctx),
    }),
};
