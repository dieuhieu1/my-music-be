'use client';

import { useState } from 'react';
import { Disc3 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Album } from '@/lib/api/albums.api';

interface Props {
  album: Album;
  index: number;
}

export function AlbumCard({ album, index }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/${locale}/albums/${album.id}`}
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
      }}
    >
      {/* Cover art — square */}
      <div style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(232,184,75,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {album.coverArtUrl
            ? <img
                src={album.coverArtUrl} alt={album.title}
                className="anim-scale-reveal"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            : <Disc3 size={40} color="rgba(232,184,75,0.18)" />
          }
        </div>
        {/* Hover shimmer */}
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
          {album.title}
        </p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3 }}>
          <span style={{ fontFamily: 'var(--font-display)' }}>{album.totalTracks}</span>
          {' tracks'}
          {album.releasedAt && ` · ${new Date(album.releasedAt).getFullYear()}`}
        </p>
      </div>
    </Link>
  );
}
