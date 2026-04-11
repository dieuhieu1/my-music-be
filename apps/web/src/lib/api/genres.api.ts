import apiClient from './axios';

export const genresApi = {
  // E4: Public list of confirmed genres
  getGenres: (page = 1, limit = 50) =>
    apiClient.get('/genres', { params: { page, limit } }),

  // L2 Admin: Create genre
  createGenre: (name: string) =>
    apiClient.post('/genres', { name }),

  // L2 Admin: Update genre
  updateGenre: (id: string, name: string) =>
    apiClient.patch(`/genres/${id}`, { name }),

  // L2 Admin: Soft-delete genre
  deleteGenre: (id: string) =>
    apiClient.delete(`/genres/${id}`),

  // D5 Admin: Approve genre suggestion
  approveSuggestion: (suggestionId: string) =>
    apiClient.post(`/genres/suggestions/${suggestionId}/approve`),

  // D5 Admin: Reject genre suggestion
  rejectSuggestion: (suggestionId: string, reason?: string) =>
    apiClient.post(`/genres/suggestions/${suggestionId}/reject`, { reason }),
};
