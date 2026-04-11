import apiClient from './axios';

export const artistApi = {
  getArtist: (id: string) =>
    apiClient.get(`/artists/${id}`),

  getMyProfile: () =>
    apiClient.get('/artists/me/profile'),

  updateMyProfile: (dto: {
    stageName?: string;
    bio?: string;
    avatarUrl?: string;
    socialLinks?: { url: string; label: string }[];
  }) => apiClient.patch('/artists/me/profile', dto),

  getMySongs: (page = 1, limit = 20) =>
    apiClient.get('/artists/me/songs', { params: { page, limit } }),

  getMyAnalytics: () =>
    apiClient.get('/artists/me/analytics'),

  getArtistAnalytics: (artistId: string) =>
    apiClient.get(`/admin/artists/${artistId}/analytics`),

  getMyDrops: (page = 1, limit = 20) =>
    apiClient.get('/artists/me/drops', { params: { page, limit } }),

  followArtist: (artistId: string) =>
    apiClient.post(`/artists/${artistId}/follow`),

  unfollowArtist: (artistId: string) =>
    apiClient.delete(`/artists/${artistId}/follow`),
};
