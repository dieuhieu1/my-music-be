import apiClient from './axios';

export interface GenreSuggestion {
  id: string;
  userId: string;
  songId: string | null;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const adminApi = {
  // ── D5: Song approval queue ────────────────────────────────────────────────

  getSongQueue: () =>
    apiClient.get('/admin/songs'),

  approveSong: (songId: string) =>
    apiClient.patch(`/admin/songs/${songId}/approve`),

  rejectSong: (songId: string, reason: string) =>
    apiClient.patch(`/admin/songs/${songId}/reject`, { reason }),

  requestReupload: (songId: string, notes: string) =>
    apiClient.patch(`/admin/songs/${songId}/reupload-required`, { notes }),

  restoreSong: (songId: string) =>
    apiClient.patch(`/admin/songs/${songId}/restore`),

  // ── L2: Genre suggestion management ───────────────────────────────────────

  getGenreSuggestions: () =>
    apiClient.get<{ data: GenreSuggestion[] }>('/admin/genres/suggestions'),

  approveGenreSuggestion: (suggestionId: string) =>
    apiClient.patch(`/admin/genres/suggestions/${suggestionId}/approve`),

  rejectGenreSuggestion: (suggestionId: string, notes?: string) =>
    apiClient.patch(`/admin/genres/suggestions/${suggestionId}/reject`, { notes }),

  // ── L3: User management (Phase 9) ─────────────────────────────────────────

  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/admin/users', { params }),

  getUser: (userId: string) =>
    apiClient.get(`/admin/users/${userId}`),

  // ── L5: Audit log (Phase 9) ────────────────────────────────────────────────

  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
    from?: string;
    to?: string;
  }) => apiClient.get('/admin/audit-logs', { params }),
};
