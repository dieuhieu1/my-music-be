import apiClient from './axios';

// ── Types ──────────────────────────────────────────────────────────────────

export type SongStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'LIVE'
  | 'REJECTED'
  | 'TAKEN_DOWN'
  | 'SCHEDULED'
  | 'REUPLOAD_REQUIRED';

export interface AdminSong {
  id: string;
  title: string;
  artistName: string | null;
  coverArtUrl: string | null;
  status: SongStatus;
  createdAt: string;   // BE: listSongsAdmin returns createdAt, not uploadedAt
  dropAt: string | null;
  totalPlays: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;          // BE: toUserSummaryDto returns "name", not "displayName"
  roles: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

export interface AdminSession {
  id: string;
  deviceName: string | null;
  deviceType: string;
  ip: string;          // BE: getUserSessions returns "ip", not "ipAddress"
  lastSeenAt: string;  // BE: returns "lastSeenAt", not "lastUsedAt"
  createdAt: string;
}

// BE findAllSuggestions returns a plain array (no pagination)
export interface GenreSuggestion {
  id: string;
  name: string;
  userId: string;      // BE returns userId, not userEmail
  songId: string | null; // BE returns songId, not songTitle
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// BE findAll() returns { id, name, description } — no songCount, no createdAt
export interface Genre {
  id: string;
  name: string;
  description: string | null;
}

export interface Report {
  id: string;
  targetId: string;
  targetType: 'SONG' | 'USER' | 'PLAYLIST' | 'COMMENT';
  targetTitle: string;
  reason: string;
  reporterEmail: string;
  status: 'PENDING' | 'DISMISSED' | 'TAKEN_DOWN';
  notes: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string | null;
  provider: string;
  status: string;
  premiumType: string | null;
  amountVnd: number | null;   // BE: listPayments returns "amountVnd", not "amount"
  transactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  totalItems: number;  // BE: all paginated list endpoints return "totalItems", not "total"
  page: number;
  size: number;
  totalPages: number;
}

// ── Songs ──────────────────────────────────────────────────────────────────

export const adminApi = {
  getSongs: (params?: {
    status?: string;
    search?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<Paginated<AdminSong>>('/admin/songs', { params }),

  approveSong: (id: string) =>
    apiClient.patch(`/admin/songs/${id}/approve`),

  rejectSong: (id: string, reason: string) =>
    apiClient.patch(`/admin/songs/${id}/reject`, { reason }),

  requireReupload: (id: string, notes: string) =>
    apiClient.patch(`/admin/songs/${id}/reupload-required`, { notes }),

  restoreSong: (id: string) =>
    apiClient.patch(`/admin/songs/${id}/restore`),

  takedownSong: (id: string) =>
    apiClient.patch(`/admin/songs/${id}/takedown`),

  // ── Users ────────────────────────────────────────────────────────────────

  getUsers: (params?: {
    role?: string;
    search?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<Paginated<AdminUser>>('/admin/users', { params }),

  getUser: (id: string) =>
    apiClient.get<AdminUser>(`/admin/users/${id}`),

  updateUserRoles: (id: string, roles: string[]) =>
    apiClient.patch(`/admin/users/${id}/roles`, { roles }),

  getUserSessions: (id: string) =>
    apiClient.get<AdminSession[]>(`/admin/users/${id}/sessions`),

  deleteUserSession: (userId: string, sessionId: string) =>
    apiClient.delete(`/admin/users/${userId}/sessions/${sessionId}`),

  // ── Genres ───────────────────────────────────────────────────────────────

  // GET /genres — public endpoint; returns plain array { id, name, description }[]
  getGenres: () =>
    apiClient.get<Genre[]>('/genres'),

  // GET /admin/genres/suggestions — returns plain array (no pagination)
  getGenreSuggestions: () =>
    apiClient.get<GenreSuggestion[]>('/admin/genres/suggestions'),

  approveGenreSuggestion: (id: string) =>
    apiClient.patch(`/admin/genres/suggestions/${id}/approve`),

  rejectGenreSuggestion: (id: string, notes?: string) =>
    apiClient.patch(`/admin/genres/suggestions/${id}/reject`, { notes }),

  // ── Reports ──────────────────────────────────────────────────────────────

  getReports: (params?: {
    status?: string;
    targetType?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<Paginated<Report>>('/admin/reports', { params }),

  dismissReport: (id: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${id}/dismiss`, { notes }),

  takedownReport: (id: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${id}/takedown`, { notes }),

  // ── Audit ────────────────────────────────────────────────────────────────

  getAuditLogs: (params?: {
    action?: string;
    adminId?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<Paginated<AuditLog>>('/admin/audit', { params }),

  // ── Payments ─────────────────────────────────────────────────────────────

  getPayments: (params?: {
    provider?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<Paginated<PaymentRecord>>('/admin/payments', { params }),

  getManualGrants: (params?: { page?: number; size?: number }) =>
    apiClient.get<Paginated<PaymentRecord>>('/admin/payments/manual-grants', { params }),

  grantPremium: (dto: { userId: string; durationDays: number; notes?: string }) =>
    apiClient.post('/admin/payments/grant', dto),

  // Fix 1: BE registers POST /admin/payments/revoke with body { userId, notes }
  // admin.controller.ts line 223: @Post('payments/revoke') + AdminRevokePremiumDto
  revokePremium: (userId: string, notes?: string) =>
    apiClient.post('/admin/payments/revoke', { userId, notes }),

  getUserSearch: (search: string) =>
    apiClient.get<Paginated<AdminUser>>('/admin/users', { params: { search, size: 10 } }),
};
