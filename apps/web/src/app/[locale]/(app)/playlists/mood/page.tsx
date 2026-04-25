'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Crown, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useQueueStore } from '@/store/useQueueStore';
import { MoodSelector } from '@/components/recommendations/MoodSelector';
import { SongRow } from '@/components/music/SongRow';
import { useMoodRecs } from '@/hooks/useMoodRecs';
import type { MoodType } from '@/lib/api/recommendations.api';
import type { Song } from '@/lib/api/songs.api';
import type { SongRecommendationDto } from '@/lib/api/recommendations.api';

const MOOD_LABELS: Record<MoodType, string> = {
  HAPPY:   'Happy Vibes',
  SAD:     'Melancholy',
  FOCUS:   'Deep Focus',
  CHILL:   'Chill Zone',
  WORKOUT: 'Workout Mode',
};

const MOOD_SUBS: Record<MoodType, string> = {
  HAPPY:   'Upbeat pop and dance to lift your spirits',
  SAD:     'Ballads and acoustic tracks for reflective moments',
  FOCUS:   'Lo-fi, ambient, and classical to keep you in the zone',
  CHILL:   'R&B, jazz, and indie for laid-back listening',
  WORKOUT: 'EDM, hip-hop, and rock to fuel your session',
};

export default function MoodPlaylistPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const initialMood = (searchParams.get('mood')?.toUpperCase() as MoodType | null) ?? undefined;
  const [selectedMood, setSelectedMood] = useState<MoodType | undefined>(initialMood);

  const { songs, resolvedMood, inferred, isLoading, error } = useMoodRecs(selectedMood, 30);

  const { setSong } = usePlayerStore();
  const { setQueue } = useQueueStore();

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    const items = songs.map((s, i) => ({
      id: s.id,
      title: s.title,
      artistName: s.artistName,
      coverArtUrl: s.coverArtUrl,
      fileUrl: '',
      durationSeconds: s.duration,
      queuePosition: i + 1,
    }));
    setQueue(items);
    setSong(items[0]);
  };

  // Sync selector highlight when BE resolves inferred mood on load
  useEffect(() => {
    if (!selectedMood && resolvedMood) {
      setSelectedMood(resolvedMood);
    }
  }, [resolvedMood, selectedMood]);

  const displayMood = resolvedMood ?? selectedMood;
  const titleLabel = displayMood ? MOOD_LABELS[displayMood] : 'Mood Playlist';
  const subLabel   = displayMood ? MOOD_SUBS[displayMood] : 'Select a mood to get started';

  const toSongRowProp = (rec: SongRecommendationDto): Song => ({
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
  });

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(24px,4vw,44px) clamp(16px,3vw,32px)' }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: 28 }}>
        <p style={{
          fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--gold)', marginBottom: 8,
        }}>
          Mood Engine
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--ivory)', fontSize: 'clamp(1.8rem,3.5vw,2.6rem)',
          fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 8px',
        }}>
          {titleLabel}
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem' }}>
          {subLabel}
        </p>
        {inferred && resolvedMood && (
          <p style={{
            color: 'var(--muted-text)', fontSize: '0.72rem',
            marginTop: 6, letterSpacing: '0.02em',
          }}>
            Inferred from your time of day
          </p>
        )}
      </div>

      {/* Mood selector */}
      <div className="anim-scale-reveal" style={{ marginBottom: 32 }}>
        <MoodSelector
          selected={selectedMood ?? null}
          onChange={(m) => setSelectedMood(m ?? undefined)}
        />
      </div>

      {/* Controls */}
      {songs.length > 0 && (
        <div
          className="anim-fade-up anim-fade-up-1"
          style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}
        >
          <button
            type="button"
            onClick={handlePlayAll}
            className="btn-gold"
            style={{
              padding: '9px 22px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#0d0d0d',
            }}
          >
            Play all
          </button>

          <span style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--muted-text)', fontSize: '0.78rem',
          }}>
            {songs.length} tracks
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="vinyl-spin" style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '2px solid rgba(232,184,75,0.15)',
            borderTopColor: 'var(--gold)',
          }} />
          <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem' }}>Finding your sound…</p>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="anim-glitch-skew" style={{
          marginTop: 28, padding: '20px', borderRadius: 8,
          border: '1px solid rgba(220,80,80,0.2)',
          background: 'rgba(220,80,80,0.04)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem' }}>
            {error.message}
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && songs.length === 0 && (
        <div style={{ marginTop: 56, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'rgba(232,184,75,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crown size={26} color="rgba(232,184,75,0.3)" />
          </div>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.88rem', marginBottom: 16 }}>
            No songs match this mood yet.
          </p>
          <Link href={`/${locale}/browse`} style={{
            color: 'var(--gold)', fontSize: '0.82rem', textDecoration: 'none',
            borderBottom: '1px solid rgba(232,184,75,0.3)',
          }}>
            Browse all songs →
          </Link>
        </div>
      )}

      {/* Track list using existing SongRow */}
      {!isLoading && songs.length > 0 && (
        <div>
          {songs.map((song, i) => (
            <SongRow
              key={song.id}
              song={toSongRowProp(song)}
              index={i}
              artistName={song.artistName}
              onPlay={(playerSong) => {
                setSong(playerSong);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
