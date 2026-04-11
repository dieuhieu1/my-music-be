import apiClient from './axios';

export const playlistsApi = {
  getPlaylists: (page = 1, limit = 20) =>
    apiClient.get('/playlists', { params: { page, limit } }),

  getPlaylist: (id: string) =>
    apiClient.get(`/playlists/${id}`),

  createPlaylist: (dto: { title: string; description?: string; coverArtUrl?: string }) =>
    apiClient.post('/playlists', dto),

  updatePlaylist: (
    id: string,
    dto: { title?: string; description?: string; coverArtUrl?: string },
  ) => apiClient.patch(`/playlists/${id}`, dto),

  deletePlaylist: (id: string) =>
    apiClient.delete(`/playlists/${id}`),

  addSong: (playlistId: string, songId: string) =>
    apiClient.post(`/playlists/${playlistId}/songs`, { songId }),

  removeSong: (playlistId: string, songId: string) =>
    apiClient.delete(`/playlists/${playlistId}/songs/${songId}`),

  reorderSongs: (playlistId: string, songId: string, newPosition: number) =>
    apiClient.patch(`/playlists/${playlistId}/songs/${songId}/position`, { newPosition }),

  savePlaylist: (id: string) =>
    apiClient.post(`/playlists/${id}/save`),

  unsavePlaylist: (id: string) =>
    apiClient.delete(`/playlists/${id}/save`),

  getSavedPlaylists: (page = 1, limit = 20) =>
    apiClient.get('/playlists/saved', { params: { page, limit } }),

  getLikedSongs: () =>
    apiClient.get('/playlists/liked-songs'),
};
