import apiClient from './axios';

export const playbackApi = {
  getState: () =>
    apiClient.get('/playback/state'),

  saveState: (songId: string, positionSeconds: number) =>
    apiClient.post('/playback/state', { songId, positionSeconds }),

  getHistory: (page = 1, limit = 20) =>
    apiClient.get('/playback/history', { params: { page, limit } }),

  // Queue (BL-31)
  getQueue: () =>
    apiClient.get('/playback/queue'),

  addToQueue: (songId: string) =>
    apiClient.post('/playback/queue', { songId }),

  removeFromQueue: (songId: string) =>
    apiClient.delete(`/playback/queue/${songId}`),

  reorderQueue: (songId: string, newPosition: number) =>
    apiClient.patch(`/playback/queue/${songId}/position`, { newPosition }),

  clearQueue: () =>
    apiClient.delete('/playback/queue'),

  toggleShuffle: (enabled: boolean) =>
    apiClient.patch('/playback/queue/shuffle', { enabled }),

  // Smart Order (BL-37C)
  toggleSmartOrder: (enabled: boolean) =>
    apiClient.patch('/playback/queue/smart-order', { enabled }),
};
