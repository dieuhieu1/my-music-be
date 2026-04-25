'use client';

import { create } from 'zustand';

export interface PlayerSong {
  id: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  fileUrl: string;
  durationSeconds: number;
}

export type RepeatMode = 'off' | 'one' | 'all';

interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  positionSeconds: number;
  volume: number;                // 0–1
  isSmartOrderOn: boolean;       // BL-37C smart queue ordering toggle
  repeatMode: RepeatMode;

  setSong: (song: PlayerSong) => void;
  setPlaying: (playing: boolean) => void;
  setPosition: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleSmartOrder: () => void;
  cycleRepeat: () => void;
  clearPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong: null,
  isPlaying: false,
  positionSeconds: 0,
  volume: 0.8,
  isSmartOrderOn: false,
  repeatMode: 'off',

  setSong: (song) => set({ currentSong: song, positionSeconds: 0 }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (positionSeconds) => set({ positionSeconds }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleSmartOrder: () => set((s) => ({ isSmartOrderOn: !s.isSmartOrderOn })),
  cycleRepeat: () => set((s) => ({
    repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
  })),
  clearPlayer: () => set({ currentSong: null, isPlaying: false, positionSeconds: 0 }),
}));
