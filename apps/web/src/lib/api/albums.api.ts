import apiClient from './axios';

export const albumsApi = {
  getAlbum: (id: string) =>
    apiClient.get(`/albums/${id}`),

  createAlbum: (dto: { title: string; description?: string; coverArtUrl?: string }) =>
    apiClient.post('/albums', dto),

  updateAlbum: (id: string, dto: { title?: string; description?: string; coverArtUrl?: string }) =>
    apiClient.patch(`/albums/${id}`, dto),

  deleteAlbum: (id: string) =>
    apiClient.delete(`/albums/${id}`),

  followAlbum: (id: string) =>
    apiClient.post(`/albums/${id}/follow`),

  unfollowAlbum: (id: string) =>
    apiClient.delete(`/albums/${id}/follow`),
};
