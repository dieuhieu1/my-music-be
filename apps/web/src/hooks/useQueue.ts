'use client';

import { useCallback } from 'react';
import { useQueueStore } from '@/store/useQueueStore';
import { playbackApi, type QueueItem } from '@/lib/api/playback.api';
import { usePlayer } from './usePlayer';
import type { PlayerSong } from '@/store/usePlayerStore';

function toPlayerSong(item: QueueItem): PlayerSong {
  return {
    id: item.id,
    title: item.title,
    artistName: item.artistName ?? 'Unknown',
    coverArtUrl: item.coverArtUrl,
    fileUrl: '',
    durationSeconds: item.durationSeconds ?? 0,
  };
}

export function useQueue() {
  const store = useQueueStore();
  const { playSong } = usePlayer();

  const refreshQueue = useCallback(async () => {
    try {
      const res = await playbackApi.getQueue();
      const raw: QueueItem[] = (res.data as any).data ?? res.data ?? [];
      const items = raw.map((item, idx) => ({
        ...toPlayerSong(item),
        queuePosition: item.position ?? idx + 1,
        queueItemId: item.queueItemId,
      }));
      store.setQueue(items as any);
    } catch {}
  }, [store]);

  const addToQueue = useCallback(async (songId: string) => {
    try {
      await playbackApi.addToQueue(songId);
      await refreshQueue();
    } catch {}
  }, [refreshQueue]);

  const removeFromQueue = useCallback(async (queueItemId: string, songId?: string) => {
    try {
      await playbackApi.removeFromQueue(queueItemId);
      // Refresh the store to keep server state in sync
      await refreshQueue();
    } catch {}
  }, [refreshQueue]);

  const smartOrder = useCallback(async () => {
    try {
      await playbackApi.smartOrder();
      await refreshQueue();
    } catch {}
  }, [refreshQueue]);

  const clearQueue = useCallback(async () => {
    try {
      await playbackApi.clearQueue();
      store.clearQueue();
    } catch {}
  }, [store]);

  const playItem = useCallback(async (item: QueueItem) => {
    await playSong(toPlayerSong(item));
  }, [playSong]);

  return { refreshQueue, addToQueue, removeFromQueue, smartOrder, clearQueue, playItem };
}
