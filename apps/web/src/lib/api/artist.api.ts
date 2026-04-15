import apiClient from './axios';

export interface SocialLink {
  platform: string;
  url: string;
}

export interface ArtistProfile {
  id: string;
  userId: string;
  stageName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  listenerCount: number;
  socialLinks: SocialLink[];
  suggestedGenres: string[];
  user: { name: string; avatarUrl: string | null };
  createdAt: string;
}

export const artistApi = {
  // GET /artists/:id/profile — :id is the artist's userId
  getArtistProfile: (userId: string) =>
    apiClient.get(`/artists/${userId}/profile`),

  // Update own artist profile — multipart if avatar file present
  updateMyProfile: (
    dto: { stageName?: string; bio?: string; socialLinks?: SocialLink[] },
    file?: File,
  ) => {
    const form = new FormData();
    if (dto.stageName !== undefined) form.append('stageName', dto.stageName);
    if (dto.bio !== undefined) form.append('bio', dto.bio);
    if (dto.socialLinks !== undefined)
      form.append('socialLinks', JSON.stringify(dto.socialLinks));
    if (file) form.append('avatar', file);
    return apiClient.patch('/artists/me/profile', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getArtistFollowers: (userId: string, page = 1, limit = 20) =>
    apiClient.get(`/artists/${userId}/followers`, { params: { page, limit } }),

  followArtist: (userId: string) =>
    apiClient.post(`/artists/${userId}/follow`),

  unfollowArtist: (userId: string) =>
    apiClient.delete(`/artists/${userId}/follow`),
};
