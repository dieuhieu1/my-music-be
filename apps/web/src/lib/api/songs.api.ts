import apiClient from './axios';

export interface Song {
  id: string;
  userId: string;
  title: string;
  duration: number | null;
  coverArtUrl: string | null;
  genreIds: string[];
  bpm: number | null;
  camelotKey: string | null;
  status: string;
  dropAt: string | null;
  reuploadReason: string | null;
  rejectionReason: string | null;
  listenCount: number;
  createdAt: string;
  updatedAt: string;
}

export const songsApi = {
  // Artist: upload a new song (multipart — audio + optional coverArt)
  uploadSong: (formData: FormData) =>
    apiClient.post('/songs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Artist: list own songs (D2)
  getMySongs: () =>
    apiClient.get<{ data: Song[] }>('/songs/mine'),

  // Get single song by ID (used by ExtractionStatus polling)
  getSong: (id: string) =>
    apiClient.get<{ data: Song }>(`/songs/${id}`),

  // Artist: update song metadata (multipart supports optional coverArt)
  updateSong: (id: string, formData: FormData) =>
    apiClient.patch(`/songs/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Artist: delete a song
  deleteSong: (id: string) =>
    apiClient.delete(`/songs/${id}`),

  // ── Phase 5+ endpoints (stubbed) ──────────────────────────────────────────

  getSongTeaser: (id: string) =>
    apiClient.get(`/songs/${id}/teaser`),

  resubmitSong: (id: string, dto: { title?: string; genreIds?: string[]; dropAt?: string }) =>
    apiClient.patch(`/songs/${id}/resubmit`, dto),

  likeSong: (id: string) =>
    apiClient.post(`/songs/${id}/like`),

  unlikeSong: (id: string) =>
    apiClient.delete(`/songs/${id}/like`),

  downloadSong: (id: string) =>
    apiClient.post(`/songs/${id}/download`),

  notifyDrop: (id: string) =>
    apiClient.post(`/songs/${id}/notify`),

  cancelDrop: (id: string) =>
    apiClient.delete(`/songs/${id}/drop`),

  rescheduleDrop: (id: string, dropAt: string) =>
    apiClient.patch(`/songs/${id}/drop`, { dropAt }),
};
