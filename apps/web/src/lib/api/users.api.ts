import apiClient from './axios';

export const usersApi = {
  getMe: () =>
    apiClient.get('/users/me'),

  updateMe: (dto: { name?: string; avatarUrl?: string }) =>
    apiClient.patch('/users/me', dto),

  getUser: (userId: string) =>
    apiClient.get(`/users/${userId}`),

  getFollowers: (userId: string, page = 1, limit = 20) =>
    apiClient.get(`/users/${userId}/followers`, { params: { page, limit } }),

  getFollowing: (userId: string, page = 1, limit = 20) =>
    apiClient.get(`/users/${userId}/following`, { params: { page, limit } }),

  follow: (userId: string) =>
    apiClient.post(`/users/${userId}/follow`),

  unfollow: (userId: string) =>
    apiClient.delete(`/users/${userId}/follow`),
};
