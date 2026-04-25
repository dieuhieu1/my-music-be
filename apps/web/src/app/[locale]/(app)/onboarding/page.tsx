'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { genresApi } from '@/lib/api/genres.api';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/store/useAuthStore';
import { GenreChip } from '@/components/onboarding/GenreChip';

const MAX_SELECT = 10;

export default function OnboardingPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Redirect if already completed
  useEffect(() => {
    if (user?.onboardingCompleted) {
      router.replace(`/${locale}/browse`);
    }
  }, [user, locale, router]);

  const { data: genres, isLoading: genresLoading } = useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const res = await genresApi.getGenres();
      return (res.data?.data ?? res.data) as { id: string; name: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (dto: { genreIds: string[]; skipped: boolean }) =>
      usersApi.completeOnboarding(dto),
    onSuccess: (res) => {
      const updated = res.data?.data ?? res.data;
      setUser({ ...user!, ...updated, onboardingCompleted: true });
      router.push(`/${locale}/browse`);
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    mutation.mutate({ genreIds: Array.from(selected), skipped: false });
  };

  const handleSkip = () => {
    mutation.mutate({ genreIds: [], skipped: true });
  };

  const canSubmit = selected.size >= 1 && !mutation.isPending;
  const atMax = selected.size >= MAX_SELECT;

  return (
    <div
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(32px,6vw,80px) clamp(16px,5vw,48px)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 600, textAlign: 'center' }}>
        {/* Logo mark */}
        <div
          className="anim-fade-up"
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(232,184,75,0.35)',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1
          className="anim-fade-up"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--ivory)', fontSize: 'clamp(1.8rem,4vw,2.8rem)',
            fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em',
            margin: '0 0 12px',
          }}
        >
          What do you want to hear?
        </h1>

        <p
          className="anim-fade-up anim-fade-up-1"
          style={{ color: 'var(--muted-text)', fontSize: '0.9rem', margin: '0 0 36px', lineHeight: 1.7 }}
        >
          Pick at least 1 genre to start. You can update this later.
        </p>

        {/* Genre chips grid */}
        {genresLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div className="vinyl-spin" style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(232,184,75,0.15)',
              borderTopColor: 'var(--gold)',
            }} />
          </div>
        ) : (
          <div
            className="anim-scale-reveal"
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 10,
              justifyContent: 'center', marginBottom: 40,
            }}
          >
            {(genres ?? []).map((genre) => (
              <GenreChip
                key={genre.id}
                label={genre.name}
                selected={selected.has(genre.id)}
                disabled={atMax && !selected.has(genre.id)}
                onClick={() => toggle(genre.id)}
              />
            ))}
          </div>
        )}

        {/* Count indicator */}
        {selected.size > 0 && (
          <p style={{
            color: 'var(--muted-text)', fontSize: '0.75rem',
            marginBottom: 20, letterSpacing: '0.04em',
          }}>
            <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
              {selected.size}
            </span>
            {' / '}{MAX_SELECT} selected
          </p>
        )}

        {/* CTA button */}
        <div className="anim-fade-up anim-fade-up-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={canSubmit ? 'btn-gold' : ''}
            style={{
              padding: '14px 48px', borderRadius: 8, fontSize: '0.92rem',
              fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              border: 'none', display: 'inline-flex', alignItems: 'center', gap: 10,
              background: canSubmit ? undefined : 'rgba(232,184,75,0.08)',
              color: canSubmit ? '#0d0d0d' : 'var(--muted-text)',
              transition: 'all 0.2s',
            }}
          >
            {mutation.isPending ? (
              <>
                <div className="vinyl-spin" style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(13,13,13,0.2)',
                  borderTopColor: '#0d0d0d',
                }} />
                Setting up…
              </>
            ) : (
              "Let's go"
            )}
          </button>
        </div>

        {/* Skip link */}
        <button
          type="button"
          onClick={handleSkip}
          disabled={mutation.isPending}
          style={{
            marginTop: 20, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-text)', fontSize: '0.8rem',
            textDecoration: 'none', display: 'inline-block',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ivory)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
