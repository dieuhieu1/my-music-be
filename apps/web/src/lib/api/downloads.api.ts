import apiClient from './axios';

export const downloadsApi = {
  // K1: Request a download license
  downloadSong: (songId: string) =>
    apiClient.post(`/songs/${songId}/download`),

  // K2: List all downloads
  getDownloads: () =>
    apiClient.get('/songs/downloads'),

  // K2: Remove a downloaded song
  removeDownload: (songId: string) =>
    apiClient.delete(`/songs/downloads/${songId}`),

  // K2: Silent revalidation on app open
  revalidate: (songIds: string[]) =>
    apiClient.post('/songs/downloads/revalidate', { songIds }),
};
