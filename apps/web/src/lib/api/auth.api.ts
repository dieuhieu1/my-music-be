import apiClient from './axios';

export interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
}

export interface RegisterArtistDto extends RegisterUserDto {
  stageName: string;
  bio: string;
  genreIds: string[];
  socialLinks?: { url: string; label: string }[];
}

export interface LoginDto {
  email: string;
  password: string;
}

export const authApi = {
  registerUser: (dto: RegisterUserDto) =>
    apiClient.post('/auth/register', dto),

  registerArtist: (dto: RegisterArtistDto) =>
    apiClient.post('/auth/register/artist', dto),

  login: (dto: LoginDto) =>
    apiClient.post('/auth/login', dto),

  logout: () =>
    apiClient.post('/auth/logout'),

  refresh: () =>
    apiClient.post('/auth/refresh'),

  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/auth/change-password', dto),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  verifyCode: (dto: { email: string; code: string }) =>
    apiClient.post('/auth/verify-code', dto),

  // Fixed: backend expects { email, code, newPassword }
  resetPassword: (dto: { email: string; code: string; newPassword: string }) =>
    apiClient.post('/auth/reset-password', dto),

  // Fixed: backend expects { email, code }
  verifyEmail: (dto: { email: string; code: string }) =>
    apiClient.post('/auth/verify-email', dto),

  // Fixed: backend expects { email } for resend
  resendVerificationEmail: (email: string) =>
    apiClient.post('/auth/resend-verification-email', { email }),

  getSessions: () =>
    apiClient.get('/auth/sessions'),

  revokeSession: (sessionId: string) =>
    apiClient.delete(`/auth/sessions/${sessionId}`),
};
