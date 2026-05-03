'use client';

import { useState } from 'react';
import { Loader2, Check, UserMinus } from 'lucide-react';
import { artistApi } from '@/lib/api/artist.api';
import { usersApi } from '@/lib/api/users.api';

interface FollowButtonProps {
  targetId: string;
  targetType: 'artist' | 'user';
  initialIsFollowing: boolean;
  size?: 'sm' | 'md' | 'lg';
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function FollowButton({
  targetId,
  targetType,
  initialIsFollowing,
  size = 'md',
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading]     = useState(false);
  const [isHover, setIsHover]         = useState(false);
  const [bounce, setBounce]           = useState(false);

  const padding =
    size === 'sm' ? '6px 14px'
    : size === 'lg' ? '12px 32px'
    : '9px 22px';

  const fontSize =
    size === 'sm' ? '0.72rem'
    : size === 'lg' ? '0.9rem'
    : '0.8rem';

  const handleClick = async () => {
    if (isLoading) return;

    // Bounce animation on click
    setBounce(true);
    setTimeout(() => setBounce(false), 420);

    const newState = !isFollowing;
    setIsFollowing(newState);       // optimistic
    onFollowChange?.(newState);
    setIsLoading(true);

    try {
      if (newState) {
        targetType === 'artist'
          ? await artistApi.followArtist(targetId)
          : await usersApi.follow(targetId);
      } else {
        targetType === 'artist'
          ? await artistApi.unfollowArtist(targetId)
          : await usersApi.unfollow(targetId);
      }
    } catch {
      // Revert on error
      setIsFollowing(!newState);
      onFollowChange?.(!newState);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Visual states ──────────────────────────────────────────────────────────
  let bg       = 'transparent';
  let border   = '1px solid var(--gold)';
  let color    = 'var(--gold)';
  let label: React.ReactNode = 'FOLLOW';

  if (isFollowing) {
    if (isHover) {
      bg     = 'rgba(201,76,76,0.1)';
      border = '1px solid rgba(201,76,76,0.5)';
      color  = '#e07070';
      label  = <><UserMinus size={13} style={{ flexShrink: 0 }} />UNFOLLOW</>;
    } else {
      bg     = 'var(--gold)';
      border = '1px solid var(--gold)';
      color  = '#0d0d0d';
      label  = <><Check size={13} style={{ flexShrink: 0 }} />FOLLOWING</>;
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={bounce ? 'follow-bounce' : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        fontSize,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        letterSpacing: '0.07em',
        background: bg,
        border,
        borderRadius: 3,
        color,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s',
        boxShadow: !isFollowing ? '0 0 0 0 rgba(232,184,75,0)' : undefined,
        opacity: isLoading ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
       onMouseEnter={(e) => {
        if (isFollowing) {
          setIsHover(true);
        } else {
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 0 18px rgba(232,184,75,0.25)';
        }
      }}
      onMouseLeave={(e) => {
        setIsHover(false);
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {isLoading ? <Loader2 size={13} className="animate-spin" style={{ flexShrink: 0 }} /> : label}
    </button>
  );
}
