'use client';

import { create } from 'zustand';

export interface AdminUser {
  id: string;
  email: string;
  name: string;   // BE toUserSummaryDto returns "name", not "displayName"
  roles: string[];
}

interface AuthState {
  adminUser: AdminUser | null;
  setAdminUser: (user: AdminUser) => void;
  clearAdminUser: () => void;
}

function loadUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('admin_user');
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  adminUser: loadUser(),
  setAdminUser: (user) => {
    localStorage.setItem('admin_user', JSON.stringify(user));
    set({ adminUser: user });
  },
  clearAdminUser: () => {
    localStorage.removeItem('admin_user');
    set({ adminUser: null });
  },
}));
