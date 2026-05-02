'use client';

import { useEffect, useCallback } from 'react';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import { useQueueStore } from '@/store/useQueueStore';
import { songsApi } from '@/lib/api/songs.api';
import { playbackApi } from '@/lib/api/playback.api';
import { recommendationsApi, type SongRecommendationDto } from '@/lib/api/recommendations.api';

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

  const next = useCallback(async () => {
    const { currentSong, positionSeconds } = usePlayerStore.getState();
    const { items, setQueue, contextType } = useQueueStore.getState();
    if (!currentSong || items.length === 0) return;

    // Record skip if before 30s mark (Phase 10 BL-35B)
    if (positionSeconds < 30) {
      playbackApi.recordPlay(currentSong.id, true).catch(() => {});
    }

    const idx = items.findIndex(i => i.id === currentSong.id);

    // If NOT in a fixed context (Album/Playlist), ALWAYS favor recommendations on Next (BL-40B)
    const isFixedContext = contextType === 'ALBUM' || contextType === 'PLAYLIST';
    
    if (!isFixedContext || idx === items.length - 1) {
      try {
        const localHour = new Date().getHours();
        const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

        const res = await recommendationsApi.getRecommendations(
          { size: 5 }, // Fetch a few to have some buffer
          { localHour, deviceType }
        );
        const recSongs: SongRecommendationDto[] = (res.data as any).data ?? res.data ?? [];
        if (recSongs.length > 0) {
          const newItems = recSongs.map((s, i) => ({
            id: s.id,
            title: s.title,
            artistName: s.artistName,
            coverArtUrl: s.coverArtUrl,
            fileUrl: '',
            durationSeconds: s.duration,
            queuePosition: items.length + i + 1,
          }));
          
          if (!isFixedContext) {
            // In discovery mode, we can just play the first recommendation
            // or even replace the rest of the queue if we want.
            // Let's just play it and keep the old items for history if needed.
            setQueue([...items.slice(0, idx + 1), ...newItems]);
            playSong(newItems[0]);
          } else {
            // End of fixed context — append and play
            setQueue([...items, ...newItems]);
            playSong(newItems[0]);
          }
          return;
        }
      } catch (err) {
        console.error('[Autoplay] Failed to fetch recommendations', err);
      }
    }

    // Normal next for fixed context
    const nextItem = items[(idx + 1) % items.length];
    if (nextItem) playSong(nextItem);
  }, [playSong]);

  const previous = useCallback(async () => {
    const { currentSong } = usePlayerStore.getState();
    const { items } = useQueueStore.getState();
    if (!currentSong || items.length === 0) return;

    const idx = items.findIndex(i => i.id === currentSong.id);
    const prevIdx = (idx - 1 + items.length) % items.length;
    const prevItem = items[prevIdx];
    if (prevItem) playSong(prevItem);
  }, [playSong]);

  const playWithContext = useCallback(async (
    songs: PlayerSong[],
    startIndex: number,
    contextType: 'PLAYLIST' | 'ALBUM' | 'DISCOVER' | 'SEARCH' | null = null
  ) => {
    useQueueStore.getState().setQueue(
      songs.map((s, idx) => ({ ...s, queuePosition: idx + 1 })),
      contextType
    );
    await playSong(songs[startIndex]);
  }, [playSong]);

  const seek = useCallback((seconds: number) => {
    const audio = getAudio();
    if (audio) {
      audio.currentTime = seconds;
      usePlayerStore.getState().setPosition(seconds);
    }
  }, []);

  // Handle natural song end — trigger next() for continuous play or autoplay
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;
    const handleEnded = () => {
      const { repeatMode } = usePlayerStore.getState();
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => usePlayerStore.getState().setPlaying(false));
      } else {
        next();
      }
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [next]);

  return { playSong, playWithContext, togglePlay, next, previous, seek, setVolume };
}
