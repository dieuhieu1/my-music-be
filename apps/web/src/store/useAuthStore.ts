'use client';

import { create } from 'zustand';
import { Role } from '@mymusic/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  premiumStatus: boolean;
  premiumExpiryDate: string | null;
  roles: Role[];
  followerCount: number;
  followingCount: number;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
  hasRole: (role: Role) => boolean;
  isPremium: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null, isLoading: false }),

  hasRole: (role: Role) => {
    const { user } = get();
    return user?.roles?.includes(role) ?? false;
  },

  isPremium: () => {
    const { user } = get();
    if (!user) return false;
    if (user.roles.includes(Role.ADMIN)) return true; // ADMIN bypasses PREMIUM checks
    return user.premiumStatus && (!user.premiumExpiryDate || new Date(user.premiumExpiryDate) > new Date());
  },
}));
