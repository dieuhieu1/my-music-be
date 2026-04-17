import apiClient from './axios';

export interface Genre {
  id: string;
  name: string;
  description: string | null;
}

export const genresApi = {
  // Public: get all active genres (used by upload form multi-select)
  getGenres: () =>
    apiClient.get<{ data: Genre[] }>('/genres'),

  // Artist: suggest a new genre
  suggestGenre: (name: string) =>
    apiClient.post('/genres/suggest', { name }),

  // ── Phase 4B Admin endpoints (stubbed) ────────────────────────────────────

  approveSuggestion: (suggestionId: string) =>
    apiClient.post(`/genres/suggestions/${suggestionId}/approve`),

  rejectSuggestion: (suggestionId: string, reason?: string) =>
    apiClient.post(`/genres/suggestions/${suggestionId}/reject`, { reason }),
};
