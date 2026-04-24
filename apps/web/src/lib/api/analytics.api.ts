import apiClient from './axios';

export interface TopSong {
  id: string;
  title: string;
  coverArtUrl: string | null;
  plays: number;
  likes: number;
}

export interface AnalyticsOverview {
  totalPlays: number;
  totalLikes: number;
  topSongs: TopSong[];
}

export interface DailyPlay {
  date: string;
  count: number;
}

export interface SongAnalytics {
  plays7d: number;
  plays30d: number;
  likes: number;
  dailyPlays: DailyPlay[];
}

export const analyticsApi = {
  getOverview: (targetArtistUserId?: string) =>
    apiClient.get<{ data: AnalyticsOverview }>('/artist/analytics/overview', {
      params: targetArtistUserId ? { userId: targetArtistUserId } : undefined,
    }),

  getSongAnalytics: (songId: string) =>
    apiClient.get<{ data: SongAnalytics }>(`/artist/analytics/${songId}`),
};
