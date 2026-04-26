'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Search, Users, Headphones, X } from 'lucide-react';
import { artistApi, type ArtistProfile } from '@/lib/api/artist.api';
import PublicHeader from '@/components/layout/PublicHeader';

const PAGE_SIZE = 20;

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function ArtistCard({ artist, locale, index }: { artist: ArtistProfile; locale: string; index: number }) {
  const [hovered, setHovered] = useState(false);
  const initials = artist.stageName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/${locale}/artists/${artist.userId}`}
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? 'rgba(232,184,75,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 12,
        padding: '24px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s, transform 0.2s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}>
        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          {artist.avatarUrl ? (
            <img
              src={artist.avatarUrl}
              alt={artist.stageName}
              className={hovered ? 'avatar-ring-pulse' : ''}
              style={{
                width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                border: `2px solid ${hovered ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.15)'}`,
                transition: 'border-color 0.2s',
              }}
            />
          ) : (
            <div
              className={hovered ? 'avatar-ring-pulse' : ''}
              style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #2a2218, #111)',
                border: `2px solid ${hovered ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600,
                color: 'var(--gold)',
                transition: 'border-color 0.2s',
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem', fontWeight: 600,
            color: hovered ? 'var(--gold)' : 'var(--ivory)',
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.2s',
          }}>
            {artist.stageName}
          </p>
          <p style={{
            fontSize: '0.68rem', color: 'var(--muted-text)',
            marginTop: 2, letterSpacing: '0.02em',
          }}>
            Artist
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 16, width: '100%', justifyContent: 'center',
          paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Users size={11} color="var(--muted-text)" />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)', fontFamily: 'var(--font-display)' }}>
              {fmt(artist.followerCount)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Headphones size={11} color="var(--muted-text)" />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)', fontFamily: 'var(--font-display)' }}>
              {fmt(artist.listenerCount)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ArtistsPage() {
  const { locale } = useParams<{ locale: string }>();

  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArtists = async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await artistApi.getArtists({ page: p, limit: PAGE_SIZE, ...(q ? { search: q } : {}) });
      const d = (res.data as any).data ?? res.data;
      setArtists(d.items ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setArtists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArtists(1, ''); }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      setPage(1);
      fetchArtists(1, val);
    }, 350);
  };

  const clearSearch = () => {
    setSearch('');
    setQuery('');
    setPage(1);
    fetchArtists(1, '');
  };

  const handlePage = (p: number) => {
    setPage(p);
    fetchArtists(p, query);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--charcoal)',
      color: 'var(--ivory)',
      fontFamily: 'var(--font-body)',
    }}>
      <PublicHeader locale={locale} />

      {/* Ambient orbs */}
      {[
        { top: '-10%', left: '-5%', size: 500, color: 'rgba(232,184,75,0.04)' },
        { bottom: '10%', right: '-5%', size: 380, color: 'rgba(232,184,75,0.025)' },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'fixed',
          ...(orb.top ? { top: orb.top } : { bottom: (orb as any).bottom }),
          ...(orb.left ? { left: orb.left } : { right: (orb as any).right }),
          width: orb.size, height: orb.size, borderRadius: '50%',
          background: orb.color, filter: 'blur(90px)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '68px 32px 80px' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-1" style={{ padding: '48px 0 32px' }}>
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--gold)', marginBottom: 8,
          }}>
            Discover
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 300, color: 'var(--ivory)',
            letterSpacing: '-0.03em', marginBottom: 6,
          }}>
            Artists
          </h1>
          {total > 0 && (
            <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', fontSize: '0.9rem' }}>
                {total}
              </span>{' '}artists on the platform
            </p>
          )}
        </div>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 40, maxWidth: 480 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(232,184,75,0.12)',
            borderRadius: 10,
            transition: 'border-color 0.18s',
          }}
            onFocus={() => {}}
          >
            <Search size={15} color="var(--muted-text)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search artists…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--ivory)', fontSize: '0.86rem',
                fontFamily: 'var(--font-body)',
                caretColor: 'var(--gold)',
              }}
            />
            {search && (
              <button type="button" onClick={clearSearch} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted-text)', padding: 0, display: 'flex',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ivory)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div className="vinyl-spin" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
              border: '2px solid rgba(232,184,75,0.2)',
            }} />
          </div>
        ) : artists.length === 0 ? (
          <div className="anim-glitch-skew" style={{
            padding: '80px 32px', textAlign: 'center',
            border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 12,
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
              No artists found
            </p>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
              {query ? `No results for "${query}"` : 'No artists on the platform yet.'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
          }}>
            {artists.map((artist, idx) => (
              <ArtistCard key={artist.userId} artist={artist} locale={locale} index={idx} />
            ))}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 48,
          }}>
            <button
              type="button"
              onClick={() => handlePage(page - 1)}
              disabled={page === 1}
              style={{
                padding: '8px 20px', borderRadius: 6,
                background: 'transparent',
                border: '1px solid rgba(232,184,75,0.15)',
                color: page === 1 ? 'var(--muted-text)' : 'var(--ivory)',
                fontSize: '0.78rem', cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1, fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (page > 1) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.4)'; }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.15)'}
            >
              Previous
            </button>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.8rem',
              color: 'var(--muted-text)', padding: '0 12px',
            }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePage(page + 1)}
              disabled={page === totalPages}
              style={{
                padding: '8px 20px', borderRadius: 6,
                background: 'transparent',
                border: '1px solid rgba(232,184,75,0.15)',
                color: page === totalPages ? 'var(--muted-text)' : 'var(--ivory)',
                fontSize: '0.78rem', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1, fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (page < totalPages) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.4)'; }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.15)'}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
