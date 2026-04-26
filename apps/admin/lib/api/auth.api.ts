import axios from 'axios';

const rawClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;   // BE auth response uses "name" not "displayName"
    roles: string[];
  };
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await rawClient.post<{ data: LoginResponse } | LoginResponse>(
      '/auth/login',
      { email, password },
    );
    // Unwrap envelope if present
    const payload = res.data as { data?: LoginResponse } & LoginResponse;
    return payload.data ?? payload;
  },
};
