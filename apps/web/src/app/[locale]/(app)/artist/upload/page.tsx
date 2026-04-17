'use client';

import { useEffect, useRef, useState, DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Music2, Image, X, Plus, Loader2 } from 'lucide-react';
import { songsApi } from '@/lib/api/songs.api';
import { albumsApi, type Album } from '@/lib/api/albums.api';
import { genresApi, type Genre } from '@/lib/api/genres.api';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';

const CAMELOT_CODES = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

function fmtBytes(b: number) {
  return b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

// ── Audio drop zone ───────────────────────────────────────────────────────────
function AudioDropZone({ file, onFile, onClear }: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  if (file) {
    return (
      <div className="anim-fade-up" style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
        background: 'rgba(232,184,75,0.04)', border: '1px solid rgba(232,184,75,0.25)', borderRadius: 8,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Music2 size={20} color="var(--gold)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--ivory)', fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 2 }}>{fmtBytes(file.size)}</p>
        </div>
        <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-text)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        padding: '48px 32px', border: `2px dashed ${drag ? 'var(--gold)' : 'rgba(232,184,75,0.2)'}`,
        borderRadius: 8, textAlign: 'center', cursor: 'pointer',
        background: drag ? 'rgba(232,184,75,0.04)' : 'transparent',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
        background: drag ? 'rgba(232,184,75,0.1)' : 'rgba(232,184,75,0.05)',
        border: '1px solid rgba(232,184,75,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
      }}>
        <Upload size={22} color="var(--gold)" />
      </div>
      <p style={{ color: 'var(--ivory)', fontSize: '0.92rem', marginBottom: 6 }}>
        Drop audio file here or <span style={{ color: 'var(--gold)', textDecoration: 'underline' }}>browse</span>
      </p>
      <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem', letterSpacing: '0.04em' }}>MP3 · FLAC · WAV · max 50 MB</p>
      <input ref={inputRef} type="file" accept=".mp3,.flac,.wav,audio/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Cover art picker ──────────────────────────────────────────────────────────
function CoverArtPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = (f: File) => { setPreview(URL.createObjectURL(f)); onChange(f); };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div onClick={() => inputRef.current?.click()} style={{
        width: 80, height: 80, borderRadius: 6, flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
        background: preview ? 'transparent' : 'rgba(232,184,75,0.04)',
        border: `1px dashed ${preview ? 'rgba(232,184,75,0.3)' : 'rgba(232,184,75,0.15)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {preview ? <img src={preview} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={24} color="rgba(232,184,75,0.4)" />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.8rem', marginBottom: 4 }}>{file ? file.name : 'No cover art'}</p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginBottom: 10 }}>JPG · PNG · WebP · max 5 MB · optional</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={{
            padding: '5px 12px', fontSize: '0.7rem', borderRadius: 4,
            background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.2)',
            color: 'var(--gold)', cursor: 'pointer', letterSpacing: '0.05em',
          }}>{file ? 'Change' : 'Choose'}</button>
          {file && <button type="button" onClick={() => { setPreview(null); onChange(null); }} style={{
            padding: '5px 12px', fontSize: '0.7rem', borderRadius: 4,
            background: 'transparent', border: '1px solid #2a2520', color: 'var(--muted-text)', cursor: 'pointer',
          }}>Remove</button>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Genre multi-select pills ──────────────────────────────────────────────────
function GenrePills({ genres, selected, onChange }: { genres: Genre[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {genres.length === 0 && <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>Loading genres…</p>}
      {genres.map((g) => {
        const on = selected.includes(g.id);
        return (
          <button key={g.id} type="button" onClick={() => toggle(g.id)} style={{
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
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UploadSongPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { hasRole } = useAuthStore();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [title, setTitle]         = useState('');
  const [bpm, setBpm]             = useState('');
  const [camelotKey, setCamelotKey] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [albumId, setAlbumId]     = useState('');
  const [dropAt, setDropAt]       = useState('');
  const [suggestGenre, setSuggestGenre] = useState('');
  const [showAdv, setShowAdv]     = useState(false);

  const [genres, setGenres]   = useState<Genre[]>([]);
  const [albums, setAlbums]   = useState<Album[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState('');

  const handleAudio = (f: File) => {
    setAudioFile(f);
    if (!title) {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  };

  useEffect(() => {
    genresApi.getGenres().then((r) => { const d = (r.data as any).data ?? r.data; setGenres(Array.isArray(d) ? d : []); }).catch(() => {});
    if (hasRole(Role.ARTIST)) {
      albumsApi.getMyAlbums().then((r) => { const d = (r.data as any).data ?? r.data; setAlbums(Array.isArray(d) ? d : []); }).catch(() => {});
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) { setError('Please select an audio file.'); return; }
    if (!title.trim()) { setError('Song title is required.'); return; }
    setUploading(true); setError('');

    const fd = new FormData();
    fd.append('audio', audioFile);
    if (coverFile) fd.append('coverArt', coverFile);
    fd.append('title', title.trim());
    selectedGenres.forEach((id) => fd.append('genreIds', id));
    if (bpm)        fd.append('bpm', bpm);
    if (camelotKey) fd.append('camelotKey', camelotKey);
    if (albumId)    fd.append('albumId', albumId);
    if (dropAt)     fd.append('dropAt', new Date(dropAt).toISOString());
    if (suggestGenre.trim()) fd.append('suggestGenre', suggestGenre.trim());

    try {
      const res = await songsApi.uploadSong(fd);
      const song = (res.data as any).data ?? res.data;
      router.push(`/${locale}/artist/songs/${song.id}/edit`);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Upload failed.';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
      setUploading(false);
    }
  };

  const isArtist = hasRole(Role.ARTIST);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <Link href={`/${locale}/artist/songs`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none', marginBottom: 20, letterSpacing: '0.04em',
        }}>
          <ArrowLeft size={13} /> My Songs
        </Link>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Artist Studio</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em' }}>
          Upload Song
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
          File is validated, metadata-stripped, encrypted, then queued for BPM & key analysis.
        </p>
      </div>

      {!isArtist && (
        <div className="anim-fade-up" style={{
          padding: '12px 16px', borderRadius: 6, marginBottom: 24,
          background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)',
          color: '#e07070', fontSize: '0.82rem',
        }}>
          Only artists can upload songs.
        </div>
      )}

      <form onSubmit={onSubmit}>

        {/* Audio */}
        <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
            Audio File <span style={{ color: 'rgba(201,76,76,0.8)' }}>*</span>
          </label>
          <AudioDropZone file={audioFile} onFile={handleAudio} onClear={() => setAudioFile(null)} />
        </div>

        {/* Cover art */}
        <div className="anim-fade-up anim-fade-up-3" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
            Cover Art
          </label>
          <CoverArtPicker file={coverFile} onChange={setCoverFile} />
        </div>

        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', margin: '4px 0 28px' }} />

        {/* Title */}
        <div className="anim-fade-up anim-fade-up-4 auth-field" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
            Song Title <span style={{ color: 'rgba(201,76,76,0.8)' }}>*</span>
          </label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled" maxLength={255}
            style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: 'var(--ivory)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
        </div>

        {/* Genres */}
        <div className="anim-fade-up anim-fade-up-5" style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
            Genres
          </label>
          <GenrePills genres={genres} selected={selectedGenres} onChange={setSelectedGenres} />
        </div>

        {/* Album */}
        {albums.length > 0 && (
          <div className="anim-fade-up anim-fade-up-6" style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
              Add to Album
            </label>
            <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} style={{
              width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #2a2520',
              borderRadius: 4, color: albumId ? 'var(--ivory)' : 'var(--muted-text)',
              fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
            }}>
              <option value="">— No album —</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        )}

        {/* Advanced toggle */}
        <div className="anim-fade-up anim-fade-up-7" style={{ marginBottom: showAdv ? 24 : 8 }}>
          <button type="button" onClick={() => setShowAdv((v) => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-text)', fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', padding: 0,
          }}>
            <Plus size={13} style={{ transform: showAdv ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
            {showAdv ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        {showAdv && (
          <div className="anim-fade-up" style={{ marginBottom: 28 }}>
            {/* BPM + Key */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
              <div className="auth-field" style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>BPM</label>
                <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} min="20" max="400" placeholder="Auto-detected"
                  style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: 'var(--ivory)', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>Key</label>
                <select value={camelotKey} onChange={(e) => setCamelotKey(e.target.value)} style={{
                  width: '100%', padding: '9px 10px', background: '#111', border: '1px solid #2a2520',
                  borderRadius: 4, color: camelotKey ? 'var(--ivory)' : 'var(--muted-text)',
                  fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
                }}>
                  <option value="">— Auto —</option>
                  {CAMELOT_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Drop date */}
            <div className="auth-field" style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>Scheduled Drop Date</label>
              <input type="datetime-local" value={dropAt} onChange={(e) => setDropAt(e.target.value)}
                style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: dropAt ? 'var(--ivory)' : 'var(--muted-text)', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', colorScheme: 'dark' }} />
            </div>

            {/* Genre suggestion */}
            <div className="auth-field">
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>Suggest a New Genre</label>
              <input type="text" value={suggestGenre} onChange={(e) => setSuggestGenre(e.target.value)}
                placeholder="e.g. Vinahouse, Phonk, Lo-fi" maxLength={100}
                style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520', color: 'var(--ivory)', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
              <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 6 }}>Reviewed by admin — may be added to the genre list.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="anim-fade-up" style={{ padding: '12px 16px', marginBottom: 20, background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)', borderRadius: 6, fontSize: '0.8rem', color: '#e07070' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="anim-fade-up anim-fade-up-8" style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={uploading || !isArtist} className="btn-gold" style={{
            flex: 1, padding: '14px 0', borderRadius: 6, border: 'none', color: '#0d0d0d',
            fontSize: '0.85rem', fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
            cursor: uploading || !isArtist ? 'not-allowed' : 'pointer', opacity: uploading || !isArtist ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><Upload size={15} /> Upload Song</>}
          </button>
          <Link href={`/${locale}/artist/songs`} style={{
            padding: '14px 20px', borderRadius: 6, border: '1px solid #2a2520', color: 'var(--muted-text)',
            fontSize: '0.85rem', fontFamily: 'var(--font-body)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', transition: 'border-color 0.2s, color 0.2s',
          }}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
