import apiClient from './axios';

export const feedApi = {
  // BL-33: Activity feed (H1)
  getFeed: (page = 1, limit = 20) =>
    apiClient.get('/feed', { params: { page, limit } }),
};
