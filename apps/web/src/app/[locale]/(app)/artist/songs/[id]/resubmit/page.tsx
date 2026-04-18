'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { songsApi, type Song } from '@/lib/api/songs.api';
import { genresApi, type Genre } from '@/lib/api/genres.api';

// ── Genre pills ───────────────────────────────────────────────────────────────
function GenrePills({ genres, selected, onChange }: {
  genres: Genre[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {genres.map((g) => {
        const on = selected.includes(g.id);
        return (
          <button key={g.id} type="button" onClick={() => toggle(g.id)} style={{
            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
            background: on ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.04)',
            border: `1px solid ${on ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.12)'}`,
            color: on ? 'var(--gold)' : 'var(--muted-text)',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}>{g.name}</button>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResubmitSongPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [song, setSong]           = useState<Song | null>(null);
  const [genres, setGenres]       = useState<Genre[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  // Form state
  const [title, setTitle]             = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [dropAt, setDropAt]           = useState('');

  useEffect(() => {
    Promise.all([
      songsApi.getSong(id),
      genresApi.getGenres(),
    ])
      .then(([songRes, genreRes]) => {
        const s: Song = (songRes.data as any).data ?? songRes.data;
        const g: Genre[] = (genreRes.data as any).data ?? genreRes.data;
        setSong(s);
        setTitle(s.title);
        setSelectedGenres(s.genreIds ?? []);
        if (s.dropAt) setDropAt(s.dropAt.slice(0, 16));
        setGenres(Array.isArray(g) ? g : []);
      })
      .catch(() => setError('Failed to load song.'))
      .finally(() => setLoading(false));
  }, [id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSubmitting(true); setError('');

    try {
      await songsApi.resubmitSong(id, {
        title: title.trim(),
        genreIds: selectedGenres,
        dropAt: dropAt ? new Date(dropAt).toISOString() : undefined,
      });
      setDone(true);
      setTimeout(() => router.push(`/${locale}/artist/songs`), 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Resubmit failed.';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="vinyl-spin" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </div>
    );
  }

  if (!song || song.status !== 'REUPLOAD_REQUIRED') {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.88rem' }}>
          {!song ? 'Song not found.' : 'This song is not awaiting resubmission.'}
        </p>
        <Link href={`/${locale}/artist/songs`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20,
          color: 'var(--gold)', fontSize: '0.8rem', textDecoration: 'none',
        }}>
          <ArrowLeft size={13} /> Back to My Songs
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <div className="anim-scale-reveal" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(120,200,120,0.1)', border: '1px solid rgba(120,200,120,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle2 size={28} color="rgba(120,200,120,0.9)" />
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)' }}>Resubmitted successfully</p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem' }}>Redirecting to your songs…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 32px', maxWidth: 680 }}>

      {/* Back link */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28 }}>
        <Link href={`/${locale}/artist/songs`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem',
          color: 'var(--muted-text)', textDecoration: 'none', letterSpacing: '0.04em',
        }}>
          <ArrowLeft size={13} /> My Songs
        </Link>
      </div>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 32 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Artist Studio
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem,4vw,2.6rem)',
          fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
        }}>
          Resubmit Song
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
          Make the requested changes and resubmit for review.
        </p>
      </div>

      {/* Admin notes banner */}
      {song.reuploadReason && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          display: 'flex', gap: 14, padding: '18px 20px', marginBottom: 32,
          background: 'rgba(240,140,60,0.06)',
          border: '1px solid rgba(240,140,60,0.25)',
          borderRadius: 8,
        }}>
          <AlertTriangle size={18} color="rgba(240,140,60,0.9)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{
              fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(240,140,60,0.7)', marginBottom: 6,
            }}>
              Admin Notes
            </p>
            <p style={{ color: 'var(--ivory)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              {song.reuploadReason}
            </p>
          </div>
        </div>
      )}

      {/* Song preview strip */}
      <div className="anim-fade-up anim-fade-up-3" style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
        background: 'rgba(17,17,17,0.6)', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 8, marginBottom: 32,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
          background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {song.coverArtUrl
            ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <RefreshCw size={16} color="rgba(232,184,75,0.3)" />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--ivory)', fontSize: '0.88rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.title}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 3 }}>
            Current version · {song.bpm ? `${song.bpm} BPM` : 'BPM unknown'}{song.camelotKey ? ` · ${song.camelotKey}` : ''}
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', marginBottom: 32 }} />

      {/* Form */}
      <form onSubmit={onSubmit}>

        {/* Title */}
        <div className="anim-fade-up anim-fade-up-4 auth-field" style={{ marginBottom: 28 }}>
          <label style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em',
            textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10,
          }}>
            Song Title <span style={{ color: 'rgba(201,76,76,0.8)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            maxLength={255}
            style={{
              width: '100%', padding: '12px 0', background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2520',
              color: 'var(--ivory)', fontSize: '1rem',
              fontFamily: 'var(--font-body)', outline: 'none',
            }}
          />
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="anim-fade-up anim-fade-up-5" style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10,
            }}>
              Genres
            </label>
            <GenrePills genres={genres} selected={selectedGenres} onChange={setSelectedGenres} />
          </div>
        )}

        {/* Drop date */}
        <div className="anim-fade-up anim-fade-up-6 auth-field" style={{ marginBottom: 32 }}>
          <label style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em',
            textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10,
          }}>
            Scheduled Drop Date
          </label>
          <input
            type="datetime-local"
            value={dropAt}
            onChange={(e) => setDropAt(e.target.value)}
            style={{
              width: '100%', padding: '10px 0', background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2520',
              color: dropAt ? 'var(--ivory)' : 'var(--muted-text)',
              fontSize: '0.9rem', fontFamily: 'var(--font-body)',
              outline: 'none', colorScheme: 'dark',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="anim-fade-up" style={{
            padding: '12px 16px', marginBottom: 20,
            background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)',
            borderRadius: 6, fontSize: '0.8rem', color: '#e07070',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="anim-fade-up anim-fade-up-7" style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            disabled={submitting}
            className="btn-gold"
            style={{
              flex: 1, padding: '14px 0', borderRadius: 6, border: 'none',
              color: '#0d0d0d', fontSize: '0.85rem', fontFamily: 'var(--font-body)',
              fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              : <><RefreshCw size={15} /> Resubmit for Review</>
            }
          </button>
          <Link href={`/${locale}/artist/songs`} style={{
            padding: '14px 20px', borderRadius: 6, border: '1px solid #2a2520',
            color: 'var(--muted-text)', fontSize: '0.85rem',
            fontFamily: 'var(--font-body)', textDecoration: 'none',
            display: 'flex', alignItems: 'center',
            transition: 'border-color 0.2s, color 0.2s',
          }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
