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

// BE findAll() returns { id, name, description, songCount }
export interface Genre {
  id: string;
  name: string;
  description: string | null;
  songCount: number;
}

export interface Report {
  id: string;
  targetId: string;
  targetType: 'SONG' | 'PLAYLIST' | 'ARTIST' | 'USER';
  targetTitle: string;
  reason: string;
  reporterEmail: string;
  status: 'PENDING' | 'DISMISSED' | 'RESOLVED';
  notes: string | null;
  createdAt: string;
}

export interface RevenueSummary {
  today: number;
  thisMonth: number;
  thisYear: number;
  allTime: number;
  last6Months: { month: string; total: number }[];
  byProvider: { provider: string; total: number; count: number }[];
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string | null;
  action: string;
  targetId: string | null;
  targetType: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OfficialArtist {
  id: string;
  stageName: string;
  bio: string | null;
  coverImageUrl: string | null;
  avatarUrl: string | null;
  socialLinks: { platform: string; url: string }[];
  suggestedGenres: string[];
  followerCount: number;
  listenerCount: number;
  isOfficial: boolean;
  createdAt: string;
  songCount?: number;
}

export interface SongStatusHistoryEntry {
  id: string;
  action: string;
  adminEmail: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AdminSongDetail {
  id: string;
  title: string;
  status: SongStatus;
  coverArtUrl: string | null;
  audioUrl: string | null;
  artistName: string | null;
  artistProfileId: string | null;
  uploaderEmail: string | null;
  uploaderName: string | null;
  bpm: number | null;
  duration: number | null;
  camelotKey: string | null;
  genreIds: string[];
  dropAt: string | null;
  totalPlays: number;
  createdAt: string;
  rejectionReason: string | null;
  reuploadReason: string | null;
  statusHistory: SongStatusHistoryEntry[];
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

  getSongDetail: (id: string) =>
    apiClient.get<AdminSongDetail>(`/admin/songs/${id}`),

  updateSongStatus: (id: string, status: SongStatus, reason?: string) =>
    apiClient.patch(`/admin/songs/${id}/status`, { status, reason }),

  uploadSong: (formData: FormData) =>
    apiClient.post('/admin/songs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // ── Official Artists ──────────────────────────────────────────────────────

  getOfficialArtists: (params?: { search?: string; page?: number; size?: number }) =>
    apiClient.get<Paginated<OfficialArtist>>('/admin/artists', { params }),

  getOfficialArtist: (id: string) =>
    apiClient.get<OfficialArtist & { songCount: number }>(`/admin/artists/${id}`),

  createOfficialArtist: (dto: {
    stageName: string;
    bio?: string;
    socialLinks?: { platform: string; url: string }[];
    suggestedGenres?: string[];
  }) => apiClient.post<OfficialArtist>('/admin/artists', dto),

  updateOfficialArtist: (id: string, dto: {
    stageName?: string;
    bio?: string;
    socialLinks?: { platform: string; url: string }[];
    suggestedGenres?: string[];
  }) => apiClient.patch<OfficialArtist>(`/admin/artists/${id}`, dto),

  deleteOfficialArtist: (id: string) =>
    apiClient.delete(`/admin/artists/${id}`),

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

  // GET /genres — public endpoint; returns plain array { id, name, description, songCount }[]
  getGenres: () =>
    apiClient.get<Genre[]>('/genres'),

  // POST /genres — ADMIN only; creates a new confirmed genre
  createGenre: (dto: { name: string; description?: string }) =>
    apiClient.post<Genre>('/genres', dto),

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
    targetType?: string;
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

  // ── Revenue ──────────────────────────────────────────────────────────────

  getRevenueSummary: () =>
    apiClient.get<RevenueSummary>('/admin/revenue/summary'),
};
