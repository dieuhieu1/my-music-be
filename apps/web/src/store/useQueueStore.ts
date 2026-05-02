'use client';

import { create } from 'zustand';
import type { PlayerSong } from './usePlayerStore';

interface QueueItem extends PlayerSong {
  queuePosition: number; // 1-based, server-assigned
}

interface QueueState {
  items: QueueItem[];
  isShuffled: boolean;
  contextType: 'PLAYLIST' | 'ALBUM' | 'DISCOVER' | 'SEARCH' | null;

  setQueue: (items: QueueItem[], contextType?: QueueState['contextType']) => void;
  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
  reorder: (fromPosition: number, toPosition: number) => void;
  setShuffled: (shuffled: boolean) => void;
  setContextType: (type: QueueState['contextType']) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  isShuffled: false,
  contextType: null,

  setQueue: (items, contextType = null) => set({ items, contextType }),
  setContextType: (contextType) => set({ contextType }),

  addToQueue: (item) =>
    set((s) => ({ items: [...s.items, item] })),

  removeFromQueue: (songId) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== songId) })),

  clearQueue: () => set({ items: [], isShuffled: false }),

  reorder: (fromPosition, toPosition) =>
    set((s) => {
      const next = [...s.items];
      const fromIdx = next.findIndex((i) => i.queuePosition === fromPosition);
      const toIdx = next.findIndex((i) => i.queuePosition === toPosition);
      if (fromIdx === -1 || toIdx === -1) return s;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { items: next.map((item, idx) => ({ ...item, queuePosition: idx + 1 })) };
    }),

  setShuffled: (isShuffled) => set({ isShuffled }),
}));
