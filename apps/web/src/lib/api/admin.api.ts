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

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

export interface AdminSession {
  id: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  provider: string;
  status: string;
  premiumType: string | null;
  durationDays: number | null;
  amount: number | null;
  notes: string | null;
  createdAt: string;
}

export const adminApi = {
  // ── D5: Song management ────────────────────────────────────────────────────

  getSongQueue: () =>
    apiClient.get('/admin/songs'),

  getSongs: (params?: {
    status?: string;
    artistId?: string;
    search?: string;
    page?: number;
    size?: number;
  }) => apiClient.get('/admin/songs', { params }),

  approveSong: (songId: string) =>
    apiClient.patch(`/admin/songs/${songId}/approve`),

  rejectSong: (songId: string, reason: string) =>
    apiClient.patch(`/admin/songs/${songId}/reject`, { reason }),

  requestReupload: (songId: string, notes: string) =>
    apiClient.patch(`/admin/songs/${songId}/reupload-required`, { notes }),

  restoreSong: (songId: string) =>
    apiClient.patch(`/admin/songs/${songId}/restore`),

  // ── L2: Genre suggestions ──────────────────────────────────────────────────

  getGenreSuggestions: () =>
    apiClient.get<{ data: GenreSuggestion[] }>('/admin/genres/suggestions'),

  approveGenreSuggestion: (suggestionId: string) =>
    apiClient.patch(`/admin/genres/suggestions/${suggestionId}/approve`),

  rejectGenreSuggestion: (suggestionId: string, notes?: string) =>
    apiClient.patch(`/admin/genres/suggestions/${suggestionId}/reject`, { notes }),

  // ── L3: User management (Phase 9) ─────────────────────────────────────────

  getUsers: (params?: {
    role?: string;
    search?: string;
    page?: number;
    size?: number;
  }) => apiClient.get('/admin/users', { params }),

  getUser: (userId: string) =>
    apiClient.get(`/admin/users/${userId}`),

  updateUserRoles: (userId: string, roles: string[]) =>
    apiClient.patch(`/admin/users/${userId}/roles`, { roles }),

  getUserSessions: (userId: string) =>
    apiClient.get(`/admin/users/${userId}/sessions`),

  deleteUserSession: (userId: string, sessionId: string) =>
    apiClient.delete(`/admin/users/${userId}/sessions/${sessionId}`),

  // ── L5: Audit log ──────────────────────────────────────────────────────────

  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
    from?: string;
    to?: string;
  }) => apiClient.get('/admin/audit-logs', { params }),

  getAudit: (params?: {
    page?: number;
    size?: number;
    action?: string;
    adminId?: string;
  }) => apiClient.get('/admin/audit', { params }),

  // ── L6: Payment records (Phase 9) ─────────────────────────────────────────

  getPayments: (params?: {
    userId?: string;
    provider?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) => apiClient.get('/admin/payments', { params }),

  getManualGrants: (params?: { page?: number; size?: number }) =>
    apiClient.get('/admin/payments/manual-grants', { params }),

  grantPremium: (dto: { userId: string; durationDays: number; notes?: string }) =>
    apiClient.post('/admin/payments/grant', dto),

  revokePremium: (userId: string, notes?: string) =>
    apiClient.delete(`/admin/payments/grant/${userId}`, { data: { notes } }),

  // ── L4: Content reports (Phase 9) ─────────────────────────────────────────

  getReports: (params?: {
    status?: string;
    targetType?: string;
    reason?: string;
    page?: number;
    size?: number;
  }) => apiClient.get('/admin/reports', { params }),

  dismissReport: (reportId: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${reportId}/dismiss`, { notes }),

  takedownReport: (reportId: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${reportId}/takedown`, { notes }),
};
