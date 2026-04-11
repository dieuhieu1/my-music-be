import apiClient from './axios';

export const notificationsApi = {
  // BL-80: Paginated notification list
  getNotifications: (page = 1, limit = 20) =>
    apiClient.get('/notifications', { params: { page, limit } }),

  // BL-82: Unread count for bell badge
  getUnreadCount: () =>
    apiClient.get('/notifications/unread-count'),

  // BL-81: Mark single notification as read
  markAsRead: (notificationId: string) =>
    apiClient.patch(`/notifications/${notificationId}/read`),

  markAllAsRead: () =>
    apiClient.patch('/notifications/read-all'),
};
