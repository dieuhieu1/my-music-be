'use client';

import { useEffect, useCallback } from 'react';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import { songsApi } from '@/lib/api/songs.api';
import { playbackApi } from '@/lib/api/playback.api';

// Module-level singletons — persist across re-renders and route changes
let _audio: HTMLAudioElement | null = null;
let _listenersAttached = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'metadata';
  }
  if (!_listenersAttached) {
    _listenersAttached = true;
    _audio.addEventListener('timeupdate', () => {
      usePlayerStore.getState().setPosition(Math.floor(_audio!.currentTime));
    });
    _audio.addEventListener('ended', () => {
      usePlayerStore.getState().setPlaying(false);
    });
    _audio.addEventListener('error', () => {
      usePlayerStore.getState().setPlaying(false);
    });
  }
  return _audio;
}

export function usePlayer() {
  const { isPlaying, volume, setVolume } = usePlayerStore();

  // Initialize audio element on first client render (no-op if already done)
  useEffect(() => { getAudio(); }, []);

  // Sync volume changes to native element
  useEffect(() => {
    const audio = getAudio();
    if (audio) audio.volume = volume;
  }, [volume]);

  // Sync play/pause state
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => usePlayerStore.getState().setPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const playSong = useCallback(async (song: PlayerSong) => {
    const audio = getAudio();
    if (!audio) return;

    const store = usePlayerStore.getState();
    store.setSong(song);
    store.setPlaying(false);

    try {
      const res = await songsApi.getStreamUrl(song.id);
      const url: string = (res.data as any).data?.url ?? (res.data as any).url;

      audio.src = url;
      audio.volume = store.volume;
      await audio.play();
      store.setPlaying(true);

      // Fire-and-forget — don't block playback
      playbackApi.recordPlay(song.id).catch(() => {});

      // OS media session (lock screen controls)
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artistName,
          artwork: song.coverArtUrl
            ? [{ src: song.coverArtUrl, sizes: '512x512', type: 'image/jpeg' }]
            : [],
        });
        navigator.mediaSession.setActionHandler('play', () => {
          audio.play();
          usePlayerStore.getState().setPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audio.pause();
          usePlayerStore.getState().setPlaying(false);
        });
      }
    } catch {
      store.setPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const store = usePlayerStore.getState();
    if (!store.currentSong) return;
    store.setPlaying(!store.isPlaying);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = getAudio();
    if (audio) {
      audio.currentTime = seconds;
      usePlayerStore.getState().setPosition(seconds);
    }
  }, []);

  return { playSong, togglePlay, seek, setVolume };
}
