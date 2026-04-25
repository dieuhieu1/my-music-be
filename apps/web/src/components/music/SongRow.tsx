'use client';

import { useState } from 'react';
import { Music2, Play, Pause } from 'lucide-react';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import type { Song } from '@/lib/api/songs.api';
import { SongContextMenu } from '@/components/music/SongContextMenu';

interface Props {
  song: Song;
  index: number;
  artistName?: string;
  onPlay: (song: PlayerSong) => void;
  onAddToQueue?: (songId: string) => void;
  onDownload?: (songId: string) => void;
}

export function SongRow({ song, index, artistName, onPlay, onAddToQueue, onDownload }: Props) {
  const { currentSong, isPlaying } = usePlayerStore();
  const isActive  = currentSong?.id === song.id;
  const [hovered, setHovered] = useState(false);

  const fmtDuration = (s: number | null) => {
    if (!s) return '—';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const handlePlay = () => {
    onPlay({
      id: song.id,
      title: song.title,
      artistName: artistName ?? song.artistName ?? 'Unknown',
      coverArtUrl: song.coverArtUrl,
      fileUrl: '',
      durationSeconds: song.duration ?? 0,
    });
  };

  return (
    <div
      onClick={handlePlay}
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '9px 14px', borderRadius: 6, cursor: 'pointer',
        background: isActive ? 'rgba(232,184,75,0.05)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      {/* Track number / play icon / waveBar */}
      <div style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive && isPlaying ? (
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
            {[0, 0.1, 0.2, 0.15, 0.05].map((delay, i) => (
              <div key={i} style={{
                width: 3, height: 14, borderRadius: 2,
                background: 'var(--gold)',
                animation: 'waveBar 0.8s ease-in-out infinite',
                animationDelay: `${delay}s`,
                transformOrigin: 'bottom',
              }} />
            ))}
          </div>
        ) : hovered ? (
          isActive
            ? <Pause size={14} fill="var(--gold)" color="var(--gold)" />
            : <Play  size={14} fill="var(--ivory)" color="var(--ivory)" style={{ marginLeft: 1 }} />
        ) : (
          <span style={{
            fontSize: '0.75rem', fontFamily: 'var(--font-display)',
            color: isActive ? 'var(--gold)' : 'var(--muted-text)',
          }}>
            {index + 1}
          </span>
        )}
      </div>

      {/* Cover art with hover overlay */}
      <div style={{
        width: 38, height: 38, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {song.coverArtUrl
          ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 size={14} color="rgba(232,184,75,0.3)" />
        }
        {/* Hover overlay on cover art */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          }}>
            {isActive && isPlaying
              ? <Pause size={14} fill="var(--ivory)" color="var(--ivory)" />
              : <Play  size={14} fill="var(--ivory)" color="var(--ivory)" style={{ marginLeft: 1 }} />
            }
          </div>
        )}
      </div>

      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color: isActive ? 'var(--gold)' : 'var(--ivory)',
          fontSize: '0.87rem', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}>
          {song.title}
        </p>
        {(artistName ?? song.artistName) && (
          <p style={{
            color: 'var(--muted-text)', fontSize: '0.71rem', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {artistName ?? song.artistName}
          </p>
        )}
      </div>

      {/* Duration */}
      <span style={{
        fontSize: '0.74rem', fontFamily: 'var(--font-display)',
        color: 'var(--muted-text)', flexShrink: 0,
      }}>
        {fmtDuration(song.duration)}
      </span>

      {/* Context menu (queue + download) */}
      {(onAddToQueue || onDownload) && (
        <div
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <SongContextMenu
            onAddToQueue={onAddToQueue ? () => onAddToQueue(song.id) : undefined}
            onDownload={onDownload ? () => onDownload(song.id) : undefined}
          />
        </div>
      )}
    </div>
  );
}
