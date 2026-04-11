import apiClient from './axios';
import type { PremiumType } from '@mymusic/types';

export const adminApi = {
  // L1: Dashboard stats
  getDashboardStats: () =>
    apiClient.get('/admin/stats'),

  // L3: User management
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/admin/users', { params }),

  getUser: (userId: string) =>
    apiClient.get(`/admin/users/${userId}`),

  grantPremium: (userId: string, dto: { premiumType: PremiumType; reason: string }) =>
    apiClient.post(`/admin/users/${userId}/premium`, dto),

  revokePremium: (userId: string, dto: { reason: string }) =>
    apiClient.delete(`/admin/users/${userId}/premium`, { data: dto }),

  getUserSessions: (userId: string) =>
    apiClient.get(`/admin/users/${userId}/sessions`),

  revokeUserSession: (userId: string, sessionId: string) =>
    apiClient.delete(`/admin/users/${userId}/sessions/${sessionId}`),

  // D5: Song approval queue
  getPendingSongs: (page = 1, limit = 20) =>
    apiClient.get('/admin/songs/pending', { params: { page, limit } }),

  approveSong: (songId: string) =>
    apiClient.post(`/admin/songs/${songId}/approve`),

  rejectSong: (songId: string, reason: string) =>
    apiClient.post(`/admin/songs/${songId}/reject`, { reason }),

  requestReupload: (songId: string, notes: string) =>
    apiClient.post(`/admin/songs/${songId}/request-reupload`, { notes }),

  restoreSong: (songId: string) =>
    apiClient.post(`/admin/songs/${songId}/restore`),

  // L5: Audit log
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
    from?: string;
    to?: string;
  }) => apiClient.get('/admin/audit-logs', { params }),
};
