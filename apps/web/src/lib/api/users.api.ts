import apiClient from './axios';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
  followerCount: number;
  followingCount: number;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  roles?: string[];
  followerCount: number;
  followingCount: number;
  createdAt: string;
}

export const usersApi = {
  getMe: () => apiClient.get('/users/me'),

  // Accepts optional avatar file — sends multipart if file present, JSON otherwise
  updateMe: (dto: { name?: string }, file?: File) => {
    if (file) {
      const form = new FormData();
      if (dto.name !== undefined) form.append('name', dto.name);
      form.append('avatar', file);
      return apiClient.patch('/users/me', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return apiClient.patch('/users/me', dto);
  },

  completeOnboarding: (dto: { genreIds: string[]; skipped: boolean }) =>
    apiClient.post('/users/me/onboarding', dto),

  getUser: (userId: string) =>
    apiClient.get(`/users/${userId}`),

  getFollowing: (userId: string, page = 1, limit = 20) =>
    apiClient.get(`/users/${userId}/following`, { params: { page, limit } }),

  follow: (userId: string) =>
    apiClient.post(`/users/${userId}/follow`),

  unfollow: (userId: string) =>
    apiClient.delete(`/users/${userId}/follow`),
};
