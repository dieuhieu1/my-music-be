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
import AuthInput from '@/components/auth/AuthInput';
import PasswordInput from '@/components/auth/PasswordInput';
import AuthButton from '@/components/auth/AuthButton';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

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
      router.push(`/${locale}/browse`);
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
      <div className="anim-fade-up anim-fade-up-1 mb-10">
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Welcome back
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1.05, color: 'var(--ivory)', marginBottom: 10 }}>
          Sign in
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
          Don&apos;t have an account?{' '}
          <Link href={`/${locale}/register`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            Create one
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          <div className="flex justify-end mt-2.5">
            <Link href={`/${locale}/forgot-password`} style={{ fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        {unverifiedEmail && (
          <div
            className="anim-fade-up"
            style={{
              padding: '14px 16px',
              background: 'rgba(232,184,75,0.06)',
              border: '1px solid rgba(232,184,75,0.2)',
              borderRadius: 6,
              lineHeight: 1.6,
            }}
          >
            <p style={{ fontSize: '0.8rem', color: 'var(--ivory)', marginBottom: 10 }}>
              Your email hasn&apos;t been verified yet.
            </p>
            <Link
              href={`/${locale}/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'var(--gold)',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#0d0d0d',
                textDecoration: 'none',
                letterSpacing: '0.04em',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 8L10.89 13.26C11.52 13.67 12.48 13.67 13.11 13.26L21 8M5 19H19C20.1 19 21 18.1 21 17V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19Z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Verify email now
            </Link>
          </div>
        )}

        {serverError && (
          <div
            className="anim-fade-up"
            style={{
              padding: '10px 14px',
              background: 'rgba(201,76,76,0.08)',
              border: '1px solid rgba(201,76,76,0.25)',
              borderRadius: 4,
              fontSize: '0.8rem',
              color: '#e07070',
              lineHeight: 1.55,
            }}
          >
            {serverError}
          </div>
        )}

        <div className="anim-fade-up anim-fade-up-4 pt-2">
          <AuthButton type="submit" loading={loading}>
            Sign in
          </AuthButton>
        </div>
      </form>

      <div className="anim-fade-up anim-fade-up-5 flex items-center gap-4 my-8">
        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)', letterSpacing: '0.08em' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
      </div>

      <div className="anim-fade-up anim-fade-up-6">
        <Link href={`/${locale}/register`}>
          <AuthButton type="button" variant="ghost">
            Create new account
          </AuthButton>
        </Link>
      </div>
    </div>
  );
}
