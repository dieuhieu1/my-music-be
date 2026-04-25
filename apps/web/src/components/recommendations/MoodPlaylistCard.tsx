'use client';

import { useState } from 'react';
import { Play, Music2, Plus } from 'lucide-react';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import type { SongRecommendationDto } from '@/lib/api/recommendations.api';

interface Props {
  song: SongRecommendationDto;
  index: number;
  onAddToQueue?: (songId: string) => void;
}

export function MoodPlaylistCard({ song, index, onAddToQueue }: Props) {
  const { currentSong, isPlaying, setSong } = usePlayerStore();
  const isActive = currentSong?.id === song.id;
  const [hovered, setHovered] = useState(false);

  const handlePlay = () => {
    const track: PlayerSong = {
      id: song.id,
      title: song.title,
      artistName: song.artistName,
      coverArtUrl: song.coverArtUrl,
      fileUrl: '',
      durationSeconds: song.duration,
    };
    setSong(track);
  };

  const mins = Math.floor(song.duration / 60);
  const secs = String(song.duration % 60).padStart(2, '0');

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${isActive ? 'rgba(232,184,75,0.3)' : hovered ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.06)'}`,
        background: isActive ? 'rgba(232,184,75,0.07)' : hovered ? 'rgba(232,184,75,0.04)' : 'transparent',
        transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Track number / play button */}
      <div
        onClick={handlePlay}
        style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center' }}
      >
        {hovered || isActive ? (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isActive && isPlaying
              ? <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                  {[0, 0.1, 0.2].map((d, i) => (
                    <div key={i} style={{
                      width: 3, height: 12, borderRadius: 1.5,
                      background: '#0d0d0d',
                      animation: 'waveBar 0.8s ease-in-out infinite',
                      animationDelay: `${d}s`,
                      transformOrigin: 'bottom',
                    }} />
                  ))}
                </div>
              : <Play size={13} fill="#0d0d0d" color="#0d0d0d" style={{ marginLeft: 1 }} />
            }
          </div>
        ) : (
          <span style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--muted-text)', fontSize: '0.85rem',
          }}>
            {index + 1}
          </span>
        )}
      </div>

      {/* Cover */}
      <div onClick={handlePlay} style={{
        width: 44, height: 44, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {song.coverArtUrl
          ? <img
              src={song.coverArtUrl} alt={song.title}
              className={isActive && isPlaying ? 'vinyl-glow' : ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          : <Music2 size={18} color="rgba(232,184,75,0.2)" />
        }
      </div>

      {/* Song info */}
      <div onClick={handlePlay} style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color: isActive ? 'var(--gold)' : 'var(--ivory)',
          fontSize: '0.88rem', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}>
          {song.title}
        </p>
        <p style={{
          color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {song.artistName}
          {song.bpm ? ` · ${song.bpm} BPM` : ''}
        </p>
      </div>

      {/* Right side: genres + duration + add-to-queue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {song.genres.slice(0, 1).map(g => (
          <span key={g} style={{
            fontSize: '0.62rem', color: 'var(--gold-dim)',
            background: 'rgba(232,184,75,0.08)', borderRadius: 4,
            padding: '2px 6px', letterSpacing: '0.03em',
          }}>
            {g}
          </span>
        ))}
        <span style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--muted-text)', fontSize: '0.78rem',
        }}>
          {mins}:{secs}
        </span>
        {onAddToQueue && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onAddToQueue(song.id); }}
            title="Add to queue"
            style={{
              opacity: hovered ? 1 : 0,
              background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
              color: 'var(--gold)', display: 'flex',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.08)')}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
