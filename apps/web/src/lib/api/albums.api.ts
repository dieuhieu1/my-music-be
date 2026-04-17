import apiClient from './axios';

export interface AlbumTrack {
  position: number;
  songId: string;
  title: string | null;
  duration: number | null;
  bpm: number | null;
  camelotKey: string | null;
  status: string | null;
}

export interface Album {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  coverArtUrl: string | null;
  totalTracks: number;
  totalHours: number;
  releasedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  tracks?: AlbumTrack[];
}

export const albumsApi = {
  // Artist: list own albums
  getMyAlbums: () =>
    apiClient.get<{ data: Album[] }>('/albums'),

  // Artist: get a single album with its track list
  getAlbum: (id: string) =>
    apiClient.get<{ data: Album }>(`/albums/${id}`),

  // Artist: create album (multipart supports optional coverArt)
  createAlbum: (formData: FormData) =>
    apiClient.post('/albums', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Artist: update album (multipart supports optional coverArt)
  updateAlbum: (id: string, formData: FormData) =>
    apiClient.patch(`/albums/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Artist: delete album
  deleteAlbum: (id: string) =>
    apiClient.delete(`/albums/${id}`),
};
