'use client';

import { useEffect, useRef, useState, DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Check, Loader2, Music2, Cpu, AlertTriangle, Image, Trash2, CheckCircle2
} from 'lucide-react';
import { songsApi, type Song } from '@/lib/api/songs.api';
import { genresApi, type Genre } from '@/lib/api/genres.api';

const CAMELOT_CODES = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending Review', APPROVED: 'Approved', LIVE: 'Live',
  SCHEDULED: 'Scheduled', REJECTED: 'Rejected',
  REUPLOAD_REQUIRED: 'Reupload Required', TAKEN_DOWN: 'Taken Down',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--gold)', APPROVED: 'rgba(120,200,120,0.9)', LIVE: 'rgba(120,200,120,0.9)',
  SCHEDULED: 'rgba(130,180,255,0.9)', REJECTED: 'rgba(220,80,80,0.9)',
  REUPLOAD_REQUIRED: 'rgba(240,140,60,0.9)', TAKEN_DOWN: 'rgba(180,80,80,0.9)',
};

// ── Extraction Status banner ─────────────────────────────────────────────────
// Polls GET /songs/:id every 3s while bpm is null. Shows shimmer on BPM/Key fields.
function ExtractionStatus({ songId, onComplete }: { songId: string; onComplete: (song: Song) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed]   = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await songsApi.getSong(songId);
        const song = (res.data as any).data ?? res.data;
        if (song.bpm !== null && song.camelotKey !== null) {
          clearInterval(pollRef.current!);
          clearInterval(tickRef.current!);
          onComplete(song);
        }
      } catch { /* ignore network errors during poll */ }
    }, 3000);

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollRef.current!);
      clearInterval(tickRef.current!);
      setFailed(true);
    }, 180_000);

    return () => {
      clearInterval(pollRef.current!);
      clearInterval(tickRef.current!);
      clearTimeout(timeout);
    };
  }, [songId]);

  if (failed) {
    return (
      <div className="anim-fade-up" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', marginBottom: 28,
        background: 'rgba(240,140,60,0.06)', border: '1px solid rgba(240,140,60,0.25)', borderRadius: 8,
      }}>
        <AlertTriangle size={16} color="rgba(240,140,60,0.9)" />
        <div>
          <p style={{ color: 'rgba(240,140,60,0.9)', fontSize: '0.82rem', fontWeight: 500 }}>Analysis timed out</p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.75rem', marginTop: 2 }}>You can still enter BPM and key manually below.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', marginBottom: 28,
      background: 'rgba(232,184,75,0.04)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
    }}>
      <div className="vinyl-spin" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)', border: '1px solid rgba(232,184,75,0.25)' }} />
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.85rem', fontWeight: 500 }}>Analysing audio…</p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.75rem', marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-display)' }}>
            {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
          </span>
          &nbsp;— extracting BPM, key, and energy from your track.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {['BPM', 'KEY'].map((label) => (
          <div key={label} style={{ textAlign: 'center', minWidth: 48 }}>
            <div className="shimmer" style={{ height: 20, width: 44, borderRadius: 3, marginBottom: 4 }} />
            <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cover art picker (inline) ─────────────────────────────────────────────────
function CoverArtPicker({
  currentUrl, file, onChange,
}: { currentUrl: string | null; file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const displayUrl = preview ?? currentUrl;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div onClick={() => inputRef.current?.click()} style={{
        width: 80, height: 80, borderRadius: 6, flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
        background: displayUrl ? 'transparent' : 'rgba(232,184,75,0.04)',
        border: `1px dashed ${displayUrl ? 'rgba(232,184,75,0.3)' : 'rgba(232,184,75,0.15)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {displayUrl ? <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={24} color="rgba(232,184,75,0.4)" />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.8rem', marginBottom: 4 }}>{file ? file.name : (currentUrl ? 'Current cover art' : 'No cover art')}</p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginBottom: 10 }}>JPG · PNG · WebP · max 5 MB</p>
        <button type="button" onClick={() => inputRef.current?.click()} style={{
          padding: '5px 12px', fontSize: '0.7rem', borderRadius: 4,
          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.2)',
          color: 'var(--gold)', cursor: 'pointer', letterSpacing: '0.05em',
        }}>Change</button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setPreview(URL.createObjectURL(f)); onChange(f); e.target.value = '';
        }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EditSongPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [song, setSong]           = useState<Song | null>(null);
  const [genres, setGenres]       = useState<Genre[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  // Editable fields
  const [title, setTitle]             = useState('');
  const [bpm, setBpm]                 = useState('');
  const [camelotKey, setCamelotKey]   = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [coverFile, setCoverFile]     = useState<File | null>(null);

  // Whether DSP is still running (bpm is null)
  const [extracting, setExtracting]   = useState(false);

  useEffect(() => {
    Promise.all([
      songsApi.getSong(id),
      genresApi.getGenres(),
    ]).then(([songRes, genresRes]) => {
      const s: Song = (songRes.data as any).data ?? songRes.data;
      const g: Genre[] = (genresRes.data as any).data ?? genresRes.data;

      setSong(s);
      setTitle(s.title);
      setBpm(s.bpm !== null ? String(s.bpm) : '');
      setCamelotKey(s.camelotKey ?? '');
      setSelectedGenres(s.genreIds ?? []);
      setGenres(Array.isArray(g) ? g : []);
      setExtracting(s.bpm === null);
    }).catch(() => setError('Failed to load song.')).finally(() => setLoading(false));
  }, [id]);

  const handleExtractionComplete = (updatedSong: Song) => {
    setSong(updatedSong);
    setBpm(updatedSong.bpm !== null ? String(updatedSong.bpm) : '');
    setCamelotKey(updatedSong.camelotKey ?? '');
    setExtracting(false);
  };

  const toggleGenre = (gId: string) =>
    setSelectedGenres((prev) => prev.includes(gId) ? prev.filter((x) => x !== gId) : [...prev, gId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError(''); setSaved(false);

    const fd = new FormData();
    fd.append('title', title.trim());
    if (bpm)        fd.append('bpm', bpm);
    if (camelotKey) fd.append('camelotKey', camelotKey);
    selectedGenres.forEach((gId) => fd.append('genreIds', gId));
    if (coverFile)  fd.append('coverArt', coverFile);

    try {
      const res = await songsApi.updateSong(id, fd);
      const updated: Song = (res.data as any).data ?? res.data;
      setSong(updated); setSaved(true);
      setTimeout(() => router.push(`/${locale}/artist/songs`), 1000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to save.';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delConfirm) { setDelConfirm(true); return; }
    setDeleting(true);
    try {
      await songsApi.deleteSong(id);
      router.push(`/${locale}/artist/songs`);
    } catch {
      setDeleting(false); setDelConfirm(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="vinyl-spin" style={{ width: 52, height: 52, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)', border: '2px solid rgba(232,184,75,0.2)' }} />
      </div>
    );
  }

  if (error && !song) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: '#e07070', marginBottom: 16 }}>{error}</p>
        <Link href={`/${locale}/artist/songs`} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to My Songs</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28 }}>
        <Link href={`/${locale}/artist/songs`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none', marginBottom: 20, letterSpacing: '0.04em',
        }}>
          <ArrowLeft size={13} /> My Songs
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Edit Song</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.01em', margin: 0 }}>
              {song?.title ?? '…'}
            </h1>
          </div>
          {song && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', letterSpacing: '0.06em',
              textTransform: 'uppercase', color: STATUS_COLOR[song.status] ?? 'var(--muted-text)',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {STATUS_LABEL[song.status] ?? song.status}
            </span>
          )}
        </div>
      </div>

      {/* Extraction status banner */}
      {extracting && song && (
        <ExtractionStatus songId={id} onComplete={handleExtractionComplete} />
      )}

      {/* Reupload reason */}
      {song?.status === 'REUPLOAD_REQUIRED' && song.reuploadReason && (
        <div className="anim-fade-up" style={{
          padding: '14px 18px', marginBottom: 28,
          background: 'rgba(240,140,60,0.06)', border: '1px solid rgba(240,140,60,0.2)', borderRadius: 8,
        }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,140,60,0.8)', marginBottom: 6 }}>Admin Feedback</p>
          <p style={{ color: 'var(--ivory)', fontSize: '0.85rem' }}>{song.reuploadReason}</p>
        </div>
      )}

      <form onSubmit={onSubmit}>

        {/* Cover art */}
        <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>Cover Art</label>
          <CoverArtPicker currentUrl={song?.coverArtUrl ?? null} file={coverFile} onChange={setCoverFile} />
        </div>

        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', margin: '4px 0 28px' }} />

        {/* Title */}
        <div className="anim-fade-up anim-fade-up-3 auth-field" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
            Song Title <span style={{ color: 'rgba(201,76,76,0.8)' }}>*</span>
          </label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
            style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: 'var(--ivory)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
        </div>

        {/* BPM + Key row (BL-37A: artist-editable after extraction) */}
        <div className="anim-fade-up anim-fade-up-4" style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
          <div className="auth-field" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
              BPM {extracting && <span style={{ color: 'rgba(232,184,75,0.4)', fontWeight: 300 }}> (detecting…)</span>}
            </label>
            {extracting ? (
              <div className="shimmer" style={{ height: 36, borderRadius: 4 }} />
            ) : (
              <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} min="20" max="400" placeholder="—"
                style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: 'var(--ivory)', fontSize: '0.9rem', fontFamily: 'var(--font-display)', outline: 'none' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
              Camelot Key {extracting && <span style={{ color: 'rgba(232,184,75,0.4)', fontWeight: 300 }}> (detecting…)</span>}
            </label>
            {extracting ? (
              <div className="shimmer" style={{ height: 36, borderRadius: 4 }} />
            ) : (
              <select value={camelotKey} onChange={(e) => setCamelotKey(e.target.value)} style={{
                width: '100%', padding: '9px 10px', background: '#111', border: '1px solid #2a2520',
                borderRadius: 4, color: camelotKey ? 'var(--ivory)' : 'var(--muted-text)',
                fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
              }}>
                <option value="">— None —</option>
                {CAMELOT_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Genres */}
        <div className="anim-fade-up anim-fade-up-5" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>Genres</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {genres.map((g) => {
              const on = selectedGenres.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggleGenre(g.id)} style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-body)',
                  background: on ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.04)',
                  border: `1px solid ${on ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.12)'}`,
                  color: on ? 'var(--gold)' : 'var(--muted-text)',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                }}>{g.name}</button>
              );
            })}
          </div>
        </div>

        {/* Duration (read-only) */}
        {song?.duration !== null && song?.duration !== undefined && (
          <div className="anim-fade-up anim-fade-up-6" style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Duration</label>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)' }}>
              {Math.floor(song.duration / 60)}:{Math.floor(song.duration % 60).toString().padStart(2, '0')}
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginLeft: 8, fontFamily: 'var(--font-body)' }}>min</span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="anim-fade-up" style={{ padding: '12px 16px', marginBottom: 20, background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)', borderRadius: 6, fontSize: '0.8rem', color: '#e07070' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="anim-fade-up anim-fade-up-7" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving || saved} className={saved ? '' : 'btn-gold'} style={{
            flex: 1, minWidth: 140, padding: '13px 0', borderRadius: 6, border: 'none',
            background: saved ? 'rgba(120,200,120,0.12)' : undefined,
            border: saved ? '1px solid rgba(120,200,120,0.25)' : undefined,
            color: saved ? '#7ac880' : '#0d0d0d', fontSize: '0.85rem', fontFamily: 'var(--font-body)',
            fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
            cursor: saving || saved ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
             saved   ? <><CheckCircle2 size={15} /> Saved</> :
                       'Save Changes'}
          </button>

          <Link href={`/${locale}/artist/songs`} style={{
            padding: '13px 20px', borderRadius: 6, border: '1px solid #2a2520', color: 'var(--muted-text)',
            fontSize: '0.85rem', fontFamily: 'var(--font-body)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', transition: 'border-color 0.2s, color 0.2s',
          }}>Cancel</Link>

          <button type="button" onClick={handleDelete} disabled={deleting} style={{
            padding: '13px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-body)',
            background: delConfirm ? 'rgba(201,76,76,0.12)' : 'transparent',
            border: `1px solid ${delConfirm ? 'rgba(201,76,76,0.4)' : '#2a2520'}`,
            color: delConfirm ? '#e07070' : 'var(--muted-text)', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {delConfirm ? 'Confirm Delete' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  );
}
