import apiClient from './axios';

export const dropsApi = {
  // I2: ARTIST/ADMIN list of scheduled drops
  getMyDrops: (page = 1, limit = 20) =>
    apiClient.get('/artists/me/drops', { params: { page, limit } }),

  getAllDrops: (page = 1, limit = 20) =>
    apiClient.get('/admin/drops', { params: { page, limit } }),

  // I3: Cancel a scheduled drop
  cancelDrop: (songId: string) =>
    apiClient.delete(`/songs/${songId}/drop`),

  // I4: Reschedule a drop
  rescheduleDrop: (songId: string, dropAt: string) =>
    apiClient.patch(`/songs/${songId}/drop`, { dropAt }),
};
