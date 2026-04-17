'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Music2, Disc, Loader2 } from 'lucide-react';
import { albumsApi, type Album } from '@/lib/api/albums.api';

function fmt(hours: number): string {
  if (hours <= 0) return '—';
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

// ── Album card ─────────────────────────────────────────────────────────────────
function AlbumCard({ album, locale, onDelete }: { album: Album; locale: string; onDelete: (id: string) => void }) {
  const [hov, setHov] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await albumsApi.deleteAlbum(album.id);
      onDelete(album.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirmDelete(false); }}
      style={{
        background: hov ? 'rgba(17,17,17,0.95)' : '#111',
        border: `1px solid ${hov ? 'rgba(232,184,75,0.2)' : 'rgba(42,37,32,0.6)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 0.18s, background 0.18s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'default',
      }}
    >
      {/* Cover */}
      <Link href={`/${locale}/albums/${album.id}/edit`} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{
          width: '100%', aspectRatio: '1 / 1', overflow: 'hidden',
          background: 'rgba(232,184,75,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {album.coverArtUrl ? (
            <img src={album.coverArtUrl} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Disc size={40} color="rgba(232,184,75,0.15)" style={{ display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', letterSpacing: '0.06em' }}>No Cover</p>
            </div>
          )}
          {/* Hover overlay */}
          {hov && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7))',
              display: 'flex', alignItems: 'flex-end', padding: 12,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 4, fontSize: '0.7rem',
                background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.3)',
                color: 'var(--gold)', letterSpacing: '0.04em',
              }}>
                <Pencil size={11} /> Edit
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding: '14px 16px 12px' }}>
        <p style={{
          color: 'var(--ivory)', fontSize: '0.9rem', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 4,
        }}>
          {album.title}
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--muted-text)' }}>
            <Music2 size={11} />
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>{album.totalTracks}</span>
            &nbsp;track{album.totalTracks !== 1 ? 's' : ''}
          </span>
          {album.totalHours > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>
              {fmt(album.totalHours)}
            </span>
          )}
          {album.releasedAt && (
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)', marginLeft: 'auto' }}>
              {new Date(album.releasedAt).getFullYear()}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/${locale}/albums/${album.id}/edit`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 0', borderRadius: 4, fontSize: '0.72rem', textDecoration: 'none',
              background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.15)',
              color: 'var(--gold)', letterSpacing: '0.04em',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)'; }}
          >
            <Pencil size={11} /> Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem',
              background: confirmDelete ? 'rgba(201,76,76,0.1)' : 'transparent',
              border: `1px solid ${confirmDelete ? 'rgba(201,76,76,0.35)' : 'rgba(42,37,32,0.8)'}`,
              color: confirmDelete ? '#e07070' : 'var(--muted-text)',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            {confirmDelete ? 'Confirm' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyAlbumsPage() {
  const { locale } = useParams<{ locale: string }>();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    albumsApi.getMyAlbums()
      .then(res => {
        const d: Album[] = (res.data as any).data ?? res.data;
        setAlbums(Array.isArray(d) ? d : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => setAlbums(prev => prev.filter(a => a.id !== id));

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Artist Studio
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,3.5vw,2.4rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
          }}>
            My Albums
          </h1>
        </div>

        <Link
          href={`/${locale}/albums/create`}
          className="btn-gold"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 6, textDecoration: 'none',
            fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: '#0d0d0d',
          }}
        >
          <Plus size={15} /> New Album
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <div className="vinyl-spin" style={{ width: 52, height: 52, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)', border: '2px solid rgba(232,184,75,0.2)' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && albums.length === 0 && (
        <div className="anim-fade-up" style={{
          padding: '60px 24px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.12)', borderRadius: 12,
        }}>
          <div className="vinyl-spin" style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.15)',
            margin: '0 auto 20px',
          }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
            No albums yet
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginBottom: 24 }}>
            Create your first album to group your tracks.
          </p>
          <Link
            href={`/${locale}/albums/create`}
            className="btn-gold"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 6, textDecoration: 'none',
              fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: '#0d0d0d',
            }}
          >
            <Plus size={14} /> Create Album
          </Link>
        </div>
      )}

      {/* Album grid */}
      {!loading && albums.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 20,
        }}>
          {albums.map((album, i) => (
            <div key={album.id} className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}>
              <AlbumCard album={album} locale={locale} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
