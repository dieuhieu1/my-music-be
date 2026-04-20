'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ListMusic, ArrowLeft } from 'lucide-react';
import { playlistsApi } from '@/lib/api/playlists.api';

export default function CreatePlaylistPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await playlistsApi.createPlaylist({ title: title.trim(), description: description.trim() || undefined, isPublic });
      router.push(`/${locale}/playlists/${r.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      {/* Aurora orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(232,184,75,0.05)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 340, height: 340, borderRadius: '50%', background: 'rgba(245,238,216,0.02)', filter: 'blur(80px)', animation: 'auroraShift2 22s ease-in-out infinite' }} />
      </div>

      <div className="anim-fade-up" style={{
        width: '100%', maxWidth: 520,
        background: 'rgba(17,17,17,0.75)',
        border: '1px solid rgba(232,184,75,0.1)',
        borderRadius: 12, padding: '40px 36px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', marginBottom: 28, padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ivory)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 10,
            background: 'rgba(232,184,75,0.08)',
            border: '1px solid rgba(232,184,75,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ListMusic size={22} color="var(--gold)" />
          </div>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.4)', marginBottom: 3 }}>
              New Playlist
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--ivory)' }}>
              Create Playlist
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 8 }}>
              Playlist Name *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="My Awesome Playlist"
              maxLength={100}
              required
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(232,184,75,0.15)',
                color: 'var(--ivory)', fontSize: '0.88rem', outline: 'none',
                transition: 'border-color 0.18s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.45)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(232,184,75,0.15)')}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 8 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this playlist about?"
              maxLength={500}
              rows={3}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(232,184,75,0.15)',
                color: 'var(--ivory)', fontSize: '0.88rem', outline: 'none',
                resize: 'vertical', lineHeight: 1.5,
                transition: 'border-color 0.18s',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.45)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(232,184,75,0.15)')}
            />
          </div>

          {/* Visibility toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--ivory)' }}>Public playlist</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted-text)', marginTop: 2 }}>Visible to all users</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: isPublic ? 'rgba(232,184,75,0.7)' : 'rgba(255,255,255,0.1)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: isPublic ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </button>
          </div>

          {error && (
            <p style={{ color: 'rgba(220,80,80,0.85)', fontSize: '0.8rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="btn-gold"
            style={{
              marginTop: 4, padding: '12px', borderRadius: 6,
              border: 'none', cursor: loading || !title.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem', fontWeight: 500, opacity: !title.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Creating…' : 'Create Playlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
