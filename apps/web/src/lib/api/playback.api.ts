import apiClient from './axios';

export interface QueueItem {
  queueItemId: string;
  position: number;
  id: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  durationSeconds: number | null;
  camelotKey: string | null;
  bpm: number | null;
}

export const playbackApi = {
  // ── Queue (BL-31) ─────────────────────────────────────────────────────────

  getQueue: () =>
    apiClient.get<{ data: QueueItem[] }>('/queue'),

  addToQueue: (songId: string) =>
    apiClient.post('/queue', { songId }),

  removeFromQueue: (itemId: string) =>
    apiClient.delete(`/queue/${itemId}`),

  reorderQueue: (items: { id: string; position: number }[]) =>
    apiClient.patch('/queue/reorder', { items }),

  smartOrder: () =>
    apiClient.patch('/queue/smart-order'),

  clearQueue: () =>
    apiClient.delete('/queue'),

  // ── Play history (BL-30) ──────────────────────────────────────────────────

  recordPlay: (songId: string, skipped: boolean = false, playedAt?: string) =>
    apiClient.post('/playback/history', { songId, skipped, ...(playedAt ? { playedAt } : {}) }),
};
