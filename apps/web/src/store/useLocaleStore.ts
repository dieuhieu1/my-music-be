'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Locale, defaultLocale } from '@/i18n/config';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'mymusic-locale' },
  ),
);
