import apiClient from './axios';

export type ReportTargetType = 'SONG' | 'PLAYLIST' | 'ARTIST' | 'USER';
export type ReportReason = 'EXPLICIT' | 'COPYRIGHT' | 'INAPPROPRIATE';

export const reportsApi = {
  // E5: Submit a content report
  createReport: (dto: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    description?: string;
  }) => apiClient.post('/reports', dto),

  // L4 Admin: List content reports
  getReports: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    reason?: string;
  }) => apiClient.get('/admin/reports', { params }),

  // L4 Admin: Dismiss a report
  dismissReport: (reportId: string) =>
    apiClient.patch(`/admin/reports/${reportId}/dismiss`),

  // L4 Admin: Take down content via a report
  takeDownReport: (reportId: string) =>
    apiClient.patch(`/admin/reports/${reportId}/take-down`),
};
