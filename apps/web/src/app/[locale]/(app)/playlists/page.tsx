'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ListMusic } from 'lucide-react';
import { playlistsApi, type Playlist } from '@/lib/api/playlists.api';
import { PlaylistCard } from '@/components/music/PlaylistCard';
import { useAuthStore } from '@/store/useAuthStore';

export default function PlaylistsPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    playlistsApi.getPlaylists(1, 50)
      .then(r => setPlaylists((r.data as { items: Playlist[] }).items ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--charcoal)' }}>
      {/* Aurora orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 480, height: 480, borderRadius: '50%', background: 'rgba(232,184,75,0.05)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(245,238,216,0.02)', filter: 'blur(80px)', animation: 'auroraShift2 22s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)', marginBottom: 6 }}>
            Your Library
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--ivory)', lineHeight: 1.15 }}>
            My Playlists
          </h1>
        </div>
        <button
          onClick={() => router.push(`/${locale}/playlists/create`)}
          className="btn-gold"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}
        >
          <Plus size={16} />
          New Playlist
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && playlists.length === 0 && (
        <div className="anim-fade-up" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', paddingTop: 100, gap: 16,
        }}>
          <ListMusic size={52} color="rgba(232,184,75,0.15)" />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--ivory)', fontWeight: 400 }}>
            No playlists yet
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.83rem' }}>
            Create your first playlist to start curating music
          </p>
          <button
            onClick={() => router.push(`/${locale}/playlists/create`)}
            className="btn-gold"
            style={{ marginTop: 8, padding: '10px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Create Playlist
          </button>
        </div>
      )}

      {/* Grid */}
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
