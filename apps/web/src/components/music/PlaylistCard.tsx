'use client';

import { useState } from 'react';
import { ListMusic } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Playlist } from '@/lib/api/playlists.api';

interface Props {
  playlist: Playlist;
  index: number;
  href?: string;
}

export function PlaylistCard({ playlist, index, href }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const [hovered, setHovered] = useState(false);
  const dest = href ?? `/${locale}/playlists/${playlist.id}`;

  return (
    <Link
      href={dest}
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', textDecoration: 'none',
        background: 'rgba(17,17,17,0.75)',
        border: `1px solid ${hovered ? 'rgba(232,184,75,0.22)' : 'rgba(232,184,75,0.07)'}`,
        borderRadius: 8, overflow: 'hidden',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Cover art — square */}
      <div style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(232,184,75,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {playlist.coverArtUrl
            ? <img
                src={playlist.coverArtUrl} alt={playlist.title}
                className="anim-scale-reveal"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            : (
              <div style={{
                width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(232,184,75,0.08) 0%, rgba(13,13,13,0.6) 100%)',
              }}>
                <ListMusic size={36} color="rgba(232,184,75,0.25)" />
              </div>
            )
          }
        </div>
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(232,184,75,0.05) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '11px 13px' }}>
        <p style={{
          color: 'var(--ivory)', fontSize: '0.87rem', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {playlist.title}
        </p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3 }}>
          <span style={{ fontFamily: 'var(--font-display)' }}>{playlist.totalTracks}</span>
          {' tracks'}
          {!playlist.isPublic && (
            <span style={{
              marginLeft: 6, fontSize: '0.6rem', letterSpacing: '0.08em',
              color: 'rgba(232,184,75,0.4)', textTransform: 'uppercase',
            }}>
              Private
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
