'use client';

import { usePlayerStore } from '@/store/usePlayerStore';

// F1 — Now Playing / Player (persistent bottom bar)
// Full implementation in Phase 6 (playback + queue)
export default function PlayerBar() {
  const { currentSong, isPlaying } = usePlayerStore();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center border-t bg-card px-6">
      {currentSong ? (
        <div className="flex w-full items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentSong.title}</p>
            <p className="truncate text-xs text-muted-foreground">{currentSong.artistName}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {isPlaying ? '▶ Playing' : '⏸ Paused'}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No song playing</p>
      )}
    </footer>
  );
}
