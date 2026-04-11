import apiClient from './axios';

export const songsApi = {
  getSong: (id: string) =>
    apiClient.get(`/songs/${id}`),

  getSongTeaser: (id: string) =>
    apiClient.get(`/songs/${id}/teaser`),

  uploadSong: (formData: FormData) =>
    apiClient.post('/songs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateSong: (id: string, dto: Record<string, unknown>) =>
    apiClient.patch(`/songs/${id}`, dto),

  resubmitSong: (id: string, formData: FormData) =>
    apiClient.patch(`/songs/${id}/resubmit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteSong: (id: string) =>
    apiClient.delete(`/songs/${id}`),

  getUploadJobStatus: (jobId: string) =>
    apiClient.get(`/songs/upload/${jobId}/status`),

  likeSong: (id: string) =>
    apiClient.post(`/songs/${id}/like`),

  unlikeSong: (id: string) =>
    apiClient.delete(`/songs/${id}/like`),

  downloadSong: (id: string) =>
    apiClient.post(`/songs/${id}/download`),

  notifyDrop: (id: string) =>
    apiClient.post(`/songs/${id}/notify`),

  cancelDropNotify: (id: string) =>
    apiClient.delete(`/songs/${id}/notify`),

  cancelDrop: (id: string) =>
    apiClient.delete(`/songs/${id}/drop`),

  rescheduleDrop: (id: string, dropAt: string) =>
    apiClient.patch(`/songs/${id}/drop`, { dropAt }),
};
