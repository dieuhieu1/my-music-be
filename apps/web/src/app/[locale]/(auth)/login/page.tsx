'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/store/useAuthStore';
import { getRoleHome } from '@/lib/utils/roleRedirect';
import AuthInput from '@/components/auth/AuthInput';
import PasswordInput from '@/components/auth/PasswordInput';
import AuthButton from '@/components/auth/AuthButton';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

/* ── Divider line ─────────────────────────────────────────────────────────── */
function GoldDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.18))' }} />
      <span style={{ fontSize: '0.62rem', color: 'var(--muted-text)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(232,184,75,0.18))' }} />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    setUnverifiedEmail('');
    setLoading(true);
    try {
      const res = await authApi.login(data);
      const user = (res.data as any)?.data?.user ?? (res.data as any)?.user;
      if (user) setUser(user);
      const roles: string[] = user?.roles ?? [];
      const isRegularUser = !roles.includes('ARTIST') && !roles.includes('ADMIN');
      if (isRegularUser && !user?.onboardingCompleted) {
        router.push(`/${locale}/onboarding`);
      } else {
        router.push(getRoleHome(user?.roles, locale));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Login failed. Please try again.';
      if (err?.response?.status === 403 && msg.toLowerCase().includes('locked')) {
        setServerError('Your account is locked due to too many failed attempts. Check your email or reset your password.');
      } else if (err?.response?.status === 403) {
        setUnverifiedEmail(data.email);
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <p style={{
          fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--gold)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 18, height: 1, background: 'var(--gold)', display: 'inline-block', opacity: 0.5 }} />
          Welcome back
          <span style={{ width: 18, height: 1, background: 'var(--gold)', display: 'inline-block', opacity: 0.5 }} />
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '2.7rem', fontWeight: 300,
          lineHeight: 1.06, color: 'var(--ivory)', marginBottom: 12, letterSpacing: '-0.02em',
        }}>
          Sign in
        </h1>
        <p style={{ fontSize: '0.83rem', color: 'var(--muted-text)', lineHeight: 1.6 }}>
          Don&apos;t have an account?{' '}
          <Link
            href={`/${locale}/register`}
            style={{
              color: 'var(--gold)', textDecoration: 'none', fontWeight: 500,
              borderBottom: '1px solid rgba(232,184,75,0.3)', paddingBottom: 1,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)')}
          >
            Create one
          </Link>
        </p>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="anim-fade-up anim-fade-up-2">
          <AuthInput
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="anim-fade-up anim-fade-up-3">
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Link
              href={`/${locale}/forgot-password`}
              style={{
                fontSize: '0.72rem', color: 'var(--muted-text)', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Unverified email notice */}
        {unverifiedEmail && (
          <div className="anim-fade-up" style={{
            padding: '14px 16px',
            background: 'rgba(232,184,75,0.05)',
            border: '1px solid rgba(232,184,75,0.18)',
            borderRadius: 8, lineHeight: 1.6,
          }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--ivory)', marginBottom: 10 }}>
              Your email hasn&apos;t been verified yet.
            </p>
            <Link
              href={`/${locale}/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: 'var(--gold)',
                borderRadius: 5, fontSize: '0.76rem', fontWeight: 600,
                color: '#0d0d0d', textDecoration: 'none', letterSpacing: '0.04em',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 8L10.89 13.26C11.52 13.67 12.48 13.67 13.11 13.26L21 8M5 19H19C20.1 19 21 18.1 21 17V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verify email now
            </Link>
          </div>
        )}

        {/* Server error */}
        {serverError && (
          <div className="anim-fade-up" style={{
            padding: '12px 15px',
            background: 'rgba(201,76,76,0.07)',
            border: '1px solid rgba(201,76,76,0.22)',
            borderRadius: 8, fontSize: '0.8rem',
            color: '#e07070', lineHeight: 1.55,
            display: 'flex', gap: 9, alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {serverError}
          </div>
        )}

        {/* Submit */}
        <div className="anim-fade-up anim-fade-up-4" style={{ paddingTop: 4 }}>
          <AuthButton type="submit" loading={loading}>
            Sign in
          </AuthButton>
        </div>
      </form>

      {/* ── Divider + Register ── */}
      <div className="anim-fade-up anim-fade-up-5" style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GoldDivider />
        <Link href={`/${locale}/register`}>
          <AuthButton type="button" variant="ghost">
            Create new account
          </AuthButton>
        </Link>
      </div>

      {/* ── Trust badges ── */}
      <div className="anim-fade-up anim-fade-up-6" style={{
        marginTop: 28, display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        {[
          { icon: '🔒', label: 'SSL Secured' },
          { icon: '🎵', label: '10M+ Tracks' },
          { icon: '⭐', label: 'Lossless Audio' },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.75rem' }}>{icon}</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--muted-text)', letterSpacing: '0.08em' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
