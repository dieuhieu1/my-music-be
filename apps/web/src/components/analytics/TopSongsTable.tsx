'use client';

import { Music2 } from 'lucide-react';
import type { TopSong } from '@/lib/api/analytics.api';

import { getAssetUrl } from '@/lib/utils/asset';

interface TopSongsTableProps {
  songs: TopSong[];
  onSelectSong?: (songId: string) => void;
  selectedSongId?: string | null;
}

export function TopSongsTable({ songs, onSelectSong, selectedSongId }: TopSongsTableProps) {
  if (!songs.length) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <Music2 size={20} color="rgba(90,85,80,0.3)" style={{ margin: '0 auto 8px' }} />
        <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>No plays yet in the last 30 days</p>
      </div>
    );
  }

  const maxPlays = Math.max(...songs.map((s) => s.plays), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {songs.map((song, idx) => {
        const isSelected = selectedSongId === song.id;
        const barW = (song.plays / maxPlays) * 100;

        return (
          <button
            key={song.id}
            type="button"
            onClick={() => onSelectSong?.(song.id)}
            className={`anim-fade-up anim-fade-up-${Math.min(idx + 1, 8)}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 14px', borderRadius: 8, cursor: onSelectSong ? 'pointer' : 'default',
              background: isSelected ? 'rgba(232,184,75,0.05)' : 'transparent',
              border: `1px solid ${isSelected ? 'rgba(232,184,75,0.2)' : 'rgba(42,37,32,0.4)'}`,
              transition: 'background 0.15s, border-color 0.15s',
              width: '100%', textAlign: 'left',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.7)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.4)';
              }
            }}
          >
            {/* Rank */}
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.82rem',
              color: isSelected ? 'var(--gold)' : 'var(--muted-text)',
              width: 18, textAlign: 'center', flexShrink: 0,
            }}>
              {idx + 1}
            </span>

            {/* Cover */}
            <div style={{
              width: 36, height: 36, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
              background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {song.coverArtUrl
                ? <img src={getAssetUrl(song.coverArtUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Music2 size={14} color="rgba(232,184,75,0.2)" />
              }
            </div>

            {/* Title + bar */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: 'var(--ivory)', fontSize: '0.84rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 5,
              }}>
                {song.title}
              </p>
              <div style={{ height: 3, background: 'rgba(42,37,32,0.6)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${barW}%`,
                  background: isSelected ? 'var(--gold)' : 'rgba(232,184,75,0.45)',
                  borderRadius: 2,
                  transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
            </div>

            {/* Stats */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>
                {song.plays.toLocaleString()}
              </p>
              <p style={{ fontSize: '0.62rem', color: 'var(--muted-text)', letterSpacing: '0.06em' }}>
                {song.likes} likes
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
