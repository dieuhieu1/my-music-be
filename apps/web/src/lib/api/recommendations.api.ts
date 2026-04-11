import apiClient from './axios';

export type Mood = 'happy' | 'sad' | 'focus' | 'chill' | 'workout';

export const recommendationsApi = {
  // BL-35: Personalized recommendations for Home page
  getRecommendations: (limit = 20) =>
    apiClient.get('/recommendations', { params: { limit } }),

  // BL-36A/B: Mood playlist (G7)
  getMoodPlaylist: (params: {
    mood?: Mood;
    timezone?: string;
    local_hour?: number;
    limit?: number;
  }) => apiClient.get('/recommendations/mood', { params }),
};
