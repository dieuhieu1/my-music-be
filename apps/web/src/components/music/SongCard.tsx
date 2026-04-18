'use client';

import { useState } from 'react';
import { Play, Plus, Music2 } from 'lucide-react';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import type { Song } from '@/lib/api/songs.api';

interface Props {
  song: Song;
  index: number;
  artistName?: string;
  onPlay: (song: PlayerSong) => void;
  onAddToQueue?: (songId: string) => void;
}

export function SongCard({ song, index, artistName, onPlay, onAddToQueue }: Props) {
  const { currentSong, isPlaying } = usePlayerStore();
  const isActive = currentSong?.id === song.id;
  const [hovered, setHovered] = useState(false);

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
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(17,17,17,0.75)',
        border: `1px solid ${isActive ? 'rgba(232,184,75,0.3)' : hovered ? 'rgba(232,184,75,0.2)' : 'rgba(232,184,75,0.07)'}`,
        borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Cover art square */}
      <div
        onClick={handlePlay}
        style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden' }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(232,184,75,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {song.coverArtUrl
            ? <img
                src={song.coverArtUrl} alt={song.title}
                className={isActive && isPlaying ? 'vinyl-glow' : ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            : <Music2 size={32} color="rgba(232,184,75,0.2)" />
          }
        </div>

        {/* Play/waveBar overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered ? 'rgba(13,13,13,0.45)' : 'rgba(13,13,13,0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.18s',
        }}>
          {hovered && !isActive && (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(232,184,75,0.4)',
              animation: 'scaleReveal 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              <Play size={18} fill="#0d0d0d" color="#0d0d0d" style={{ marginLeft: 2 }} />
            </div>
          )}
          {/* Now-playing waveBar overlay */}
          {isActive && isPlaying && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
              {[0, 0.1, 0.2, 0.15].map((delay, i) => (
                <div key={i} style={{
                  width: 4, height: 18, borderRadius: 2,
                  background: 'var(--gold)',
                  animation: 'waveBar 0.8s ease-in-out infinite',
                  animationDelay: `${delay}s`,
                  transformOrigin: 'bottom',
                }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info row */}
      <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }} onClick={handlePlay}>
          <p style={{
            color: isActive ? 'var(--gold)' : 'var(--ivory)',
            fontSize: '0.87rem', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s',
          }}>
            {song.title}
          </p>
          <p style={{
            color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {artistName ?? song.artistName ?? 'Unknown'}
            {song.bpm ? ` · ${song.bpm} BPM` : ''}
          </p>
        </div>
        {onAddToQueue && hovered && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onAddToQueue(song.id); }}
            title="Add to queue"
            style={{
              background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
              color: 'var(--gold)', display: 'flex', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.08)')}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
