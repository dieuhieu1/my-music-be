import apiClient from './axios';

export const dropsApi = {
  // I2: ARTIST/ADMIN list of scheduled drops (BL-59, BL-63, BL-65)
  getDrops: (page = 1, size = 20) =>
    apiClient.get('/drops', { params: { page, size } }),

  // I3: Cancel a scheduled drop (BL-63)
  cancelDrop: (songId: string) =>
    apiClient.delete(`/songs/${songId}/drop`),

  // I4: Reschedule a drop (BL-65)
  rescheduleDrop: (songId: string, dropAt: string) =>
    apiClient.patch(`/songs/${songId}/drop`, { dropAt }),

  // I1: Opt-in to drop notification (BL-64)
  subscribeNotify: (songId: string) =>
    apiClient.post(`/songs/${songId}/notify`),

  // I1: Opt-out from drop notification (BL-64)
  unsubscribeNotify: (songId: string) =>
    apiClient.delete(`/songs/${songId}/notify`),
};
