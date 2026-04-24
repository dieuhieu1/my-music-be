'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Heart, Play } from 'lucide-react';
import { analyticsApi, type AnalyticsOverview, type SongAnalytics } from '@/lib/api/analytics.api';
import { SongAnalyticsChart } from '@/components/analytics/SongAnalyticsChart';
import { TopSongsTable } from '@/components/analytics/TopSongsTable';

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, value, label, accent = false }: {
  icon: React.ElementType;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '20px 22px',
      background: accent ? 'rgba(232,184,75,0.04)' : 'rgba(17,17,17,0.8)',
      border: `1px solid ${accent ? 'rgba(232,184,75,0.18)' : 'rgba(42,37,32,0.5)'}`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: accent ? 'rgba(232,184,75,0.08)' : 'rgba(42,37,32,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={accent ? 'var(--gold)' : 'var(--muted-text)'} />
        </div>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
          {label}
        </p>
      </div>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400,
        color: accent ? 'var(--gold)' : 'var(--ivory)', lineHeight: 1,
      }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ── Song detail panel ─────────────────────────────────────────────────────────
function SongDetailPanel({ songId }: { songId: string }) {
  const [data, setData]     = useState<SongAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    analyticsApi.getSongAnalytics(songId)
      .then((r) => {
        const d = (r.data as any).data ?? r.data;
        setData(d);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [songId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div className="vinyl-spin" style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
        border: '2px solid rgba(232,184,75,0.2)',
      }} />
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>Failed to load song analytics</p>
    </div>
  );

  return (
    <div className="anim-fade-up">
      {/* Period stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Plays (7d)',  value: data.plays7d  },
          { label: 'Plays (30d)', value: data.plays30d },
          { label: 'Total likes', value: data.likes    },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '14px 16px', borderRadius: 6,
            background: 'rgba(17,17,17,0.6)', border: '1px solid rgba(42,37,32,0.4)',
          }}>
            <p style={{ fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 6 }}>
              {label}
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--ivory)' }}>
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{
        padding: '16px 16px 8px',
        background: 'rgba(17,17,17,0.5)', border: '1px solid rgba(42,37,32,0.4)',
        borderRadius: 8,
      }}>
        <p style={{
          fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(232,184,75,0.4)', marginBottom: 12,
        }}>
          Daily plays — last 30 days
        </p>
        <SongAnalyticsChart data={data.dailyPlays} height={130} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ArtistAnalyticsPage() {
  const [overview, setOverview]   = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading]     = useState(true);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);

  const loadOverview = useCallback(() => {
    setLoading(true);
    analyticsApi.getOverview()
      .then((r) => {
        const d = (r.data as any).data ?? r.data;
        setOverview(d);
        if (d.topSongs?.length) setSelectedSong(d.topSongs[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="vinyl-spin" style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
        border: '2px solid rgba(232,184,75,0.2)',
      }} />
    </div>
  );

  return (
    <div style={{ padding: '32px 32px', maxWidth: 900 }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Artist Studio
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem,4vw,2.6rem)',
          fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
        }}>
          Analytics
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
          Plays and engagement across your catalogue.
        </p>
      </div>

      {/* Overview stats */}
      {overview && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 36,
        }}>
          <StatPill icon={Play}       value={overview.totalPlays} label="Total plays"  accent />
          <StatPill icon={Heart}      value={overview.totalLikes} label="Total likes"           />
          <StatPill icon={TrendingUp} value={overview.topSongs.length} label="Top songs tracked" />
        </div>
      )}

      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(42,37,32,0.8), transparent)', marginBottom: 36 }} />

      {/* Two-column: top songs + song detail */}
      {overview && overview.topSongs.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* Top songs */}
          <div className="anim-fade-up anim-fade-up-3">
            <p style={{
              fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase',
              color: 'rgba(232,184,75,0.4)', marginBottom: 14,
            }}>
              Top songs — last 30 days
            </p>
            <TopSongsTable
              songs={overview.topSongs}
              onSelectSong={setSelectedSong}
              selectedSongId={selectedSong}
            />
          </div>

          {/* Song detail */}
          <div className="anim-fade-up anim-fade-up-4">
            <p style={{
              fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase',
              color: 'rgba(232,184,75,0.4)', marginBottom: 14,
            }}>
              {selectedSong
                ? overview.topSongs.find((s) => s.id === selectedSong)?.title ?? 'Song detail'
                : 'Select a song'}
            </p>
            {selectedSong
              ? <SongDetailPanel key={selectedSong} songId={selectedSong} />
              : (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <TrendingUp size={24} color="rgba(90,85,80,0.3)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>
                    Select a song to view detailed stats
                  </p>
                </div>
              )
            }
          </div>
        </div>
      ) : (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(42,37,32,0.5)', borderRadius: 10,
        }}>
          <TrendingUp size={28} color="rgba(90,85,80,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)', marginBottom: 6 }}>
            No play data yet
          </p>
          <p style={{ color: 'rgba(90,85,80,0.6)', fontSize: '0.78rem' }}>
            Analytics appear once your songs start getting plays.
          </p>
        </div>
      )}
    </div>
  );
}
