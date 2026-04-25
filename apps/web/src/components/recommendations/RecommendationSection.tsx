'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useQueue } from '@/hooks/useQueue';
import { SongCard } from '@/components/music/SongCard';
import type { SongRecommendationDto } from '@/lib/api/recommendations.api';
import type { Song } from '@/lib/api/songs.api';

// Adapter: SongRecommendationDto → Song shape expected by SongCard/SongRow
function recToSong(rec: SongRecommendationDto): Song {
  return {
    id: rec.id,
    userId: '',
    title: rec.title,
    duration: rec.duration,
    coverArtUrl: rec.coverArtUrl,
    genreIds: [],
    bpm: rec.bpm,
    camelotKey: rec.camelotKey,
    status: 'LIVE',
    dropAt: null,
    reuploadReason: null,
    rejectionReason: null,
    listenCount: rec.totalPlays,
    createdAt: rec.createdAt,
    updatedAt: rec.createdAt,
    artistName: rec.artistName,
  };
}

interface Props {
  title: string;
  subtitle?: string;
  songs: SongRecommendationDto[];
  loading?: boolean;
  onPlayAll?: () => void;
  timeRangeToggle?: {
    value: '7d' | '30d';
    onChange: (v: '7d' | '30d') => void;
  };
}

function SkeletonCard() {
  return (
    <div style={{
      width: 155, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
      border: '1px solid rgba(232,184,75,0.06)', background: 'rgba(17,17,17,0.8)',
    }}>
      <div style={{ paddingBottom: '100%', background: 'rgba(232,184,75,0.04)', position: 'relative' }}>
        <div className="vinyl-spin" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(232,184,75,0.15)',
          borderTopColor: 'var(--gold)',
        }} />
      </div>
      <div style={{ padding: '10px 11px' }}>
        <div style={{ height: 11, borderRadius: 5, background: 'rgba(232,184,75,0.07)', marginBottom: 6 }} />
        <div style={{ height: 9, borderRadius: 4, width: '60%', background: 'rgba(232,184,75,0.04)' }} />
      </div>
    </div>
  );
}

export function RecommendationSection({ title, subtitle, songs, loading, onPlayAll, timeRangeToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setSong } = usePlayerStore();
  const { addToQueue } = useQueue();

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  if (!loading && songs.length === 0) return null;

  return (
    <section className="anim-fade-up" style={{ marginBottom: 40 }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 16, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          {/* Section label — tracked uppercase DM Sans muted */}
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--muted-text)', fontFamily: 'var(--font-body)', marginBottom: 4,
          }}>
            {subtitle ?? 'Recommendations'}
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--ivory)', fontSize: '1.2rem', fontWeight: 700,
            letterSpacing: '-0.01em', margin: 0,
          }}>
            {title}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Time range toggle */}
          {timeRangeToggle && (
            <div style={{
              display: 'flex', borderRadius: 6,
              border: '1px solid rgba(232,184,75,0.12)',
              overflow: 'hidden',
            }}>
              {(['7d', '30d'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => timeRangeToggle.onChange(v)}
                  style={{
                    padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', border: 'none',
                    background: timeRangeToggle.value === v ? 'rgba(232,184,75,0.12)' : 'transparent',
                    color: timeRangeToggle.value === v ? 'var(--gold)' : 'var(--muted-text)',
                    fontFamily: 'var(--font-body)', fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {v === '7d' ? 'This week' : 'This month'}
                </button>
              ))}
            </div>
          )}

          {/* Play all link */}
          {onPlayAll && songs.length > 0 && (
            <button
              type="button"
              onClick={onPlayAll}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--gold)', fontSize: '0.78rem', fontWeight: 500,
                letterSpacing: '0.02em', padding: '5px 0',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Play all
            </button>
          )}

          {/* Scroll arrows */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'right'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => scroll(dir)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                  border: '1px solid rgba(232,184,75,0.14)',
                  background: 'rgba(17,17,17,0.8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted-text)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.35)';
                  e.currentTarget.style.color = 'var(--ivory)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.14)';
                  e.currentTarget.style.color = 'var(--muted-text)';
                }}
              >
                {dir === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable row — hidden scrollbar */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6,
          scrollbarWidth: 'none',
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : songs.map((rec, i) => (
              <div key={rec.id} style={{ width: 155, flexShrink: 0 }}>
                <SongCard
                  song={recToSong(rec)}
                  index={i}
                  artistName={rec.artistName}
                  onPlay={(playerSong) => setSong(playerSong)}
                  onAddToQueue={(id) => addToQueue(id)}
                />
              </div>
            ))
        }
      </div>
    </section>
  );
}
