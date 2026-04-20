import apiClient from './axios';

export interface PlaylistSongItem {
  playlistSongId: string;
  position: number;
  addedAt: string;
  id: string;
  title: string;
  artistName: string | null;
  duration: number | null;
  coverArtUrl: string | null;
  bpm: number | null;
  camelotKey: string | null;
  status: string;
  isTakenDown: boolean;
}

export interface Playlist {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  coverArtUrl: string | null;
  isPublic: boolean;
  isLikedSongs: boolean;
  totalTracks: number;
  totalHours: number;
  listenerCount: number;
  createdAt: string;
  updatedAt: string;
  // Detail view only
  isSaved?: boolean;
  songs?: PlaylistSongItem[];
}

export const playlistsApi = {
  getPlaylists: (page = 1, limit = 20) =>
    apiClient.get('/playlists', { params: { page, limit } }),

  getPlaylist: (id: string) =>
    apiClient.get(`/playlists/${id}`),

  createPlaylist: (dto: { title: string; description?: string; isPublic?: boolean }) =>
    apiClient.post('/playlists', dto),

  updatePlaylist: (id: string, dto: { title?: string; description?: string; isPublic?: boolean }) =>
    apiClient.patch(`/playlists/${id}`, dto),

  deletePlaylist: (id: string) =>
    apiClient.delete(`/playlists/${id}`),

  addSong: (playlistId: string, songId: string) =>
    apiClient.post(`/playlists/${playlistId}/songs`, { songId }),

  removeSong: (playlistId: string, songId: string) =>
    apiClient.delete(`/playlists/${playlistId}/songs/${songId}`),

  savePlaylist: (id: string) =>
    apiClient.post(`/playlists/${id}/save`),

  unsavePlaylist: (id: string) =>
    apiClient.delete(`/playlists/${id}/save`),

  getSavedPlaylists: (page = 1, limit = 20) =>
    apiClient.get('/playlists/saved', { params: { page, limit } }),

  getLikedSongs: () =>
    apiClient.get('/playlists/liked'),

  getUserPlaylists: (userId: string, page = 1, limit = 20) =>
    apiClient.get('/playlists', { params: { userId, page, limit } }),
};
