import apiClient from './axios';

export type ReportTargetType = 'SONG' | 'PLAYLIST' | 'ARTIST';
export type ReportReason = 'EXPLICIT' | 'COPYRIGHT' | 'INAPPROPRIATE';
export type ReportStatus = 'PENDING' | 'DISMISSED' | 'RESOLVED';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ReportStatus;
  notes: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const reportsApi = {
  createReport: (dto: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
  }) => apiClient.post('/reports', dto),

  getReports: (params?: {
    status?: ReportStatus;
    targetType?: ReportTargetType;
    reason?: ReportReason;
    page?: number;
    size?: number;
  }) => apiClient.get('/admin/reports', { params }),

  dismissReport: (reportId: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${reportId}/dismiss`, { notes }),

  takedownReport: (reportId: string, notes?: string) =>
    apiClient.patch(`/admin/reports/${reportId}/takedown`, { notes }),
};
