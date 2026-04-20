'use client';

import { useEffect, useState } from 'react';
import { BookmarkCheck, ListMusic } from 'lucide-react';
import { playlistsApi, type Playlist } from '@/lib/api/playlists.api';
import { PlaylistCard } from '@/components/music/PlaylistCard';

export default function SavedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    playlistsApi.getSavedPlaylists(1, 50)
      .then(r => setPlaylists((r.data as { items: Playlist[] }).items ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--charcoal)' }}>
      {/* Aurora orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(232,184,75,0.05)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 340, height: 340, borderRadius: '50%', background: 'rgba(245,238,216,0.02)', filter: 'blur(80px)', animation: 'auroraShift2 22s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)', marginBottom: 6 }}>
          Your Library
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BookmarkCheck size={28} color="var(--gold)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--ivory)', lineHeight: 1.15 }}>
            Saved Playlists
          </h1>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <div className="anim-fade-up" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', paddingTop: 100, gap: 14,
        }}>
          <ListMusic size={48} color="rgba(232,184,75,0.12)" />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', fontWeight: 400 }}>
            No saved playlists
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', textAlign: 'center', maxWidth: 320 }}>
            Browse public playlists and save the ones you love
          </p>
        </div>
      )}

      {!loading && playlists.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
          gap: 18,
        }}>
          {playlists.map((pl, i) => (
            <PlaylistCard key={pl.id} playlist={pl} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
