'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router  = useRouter();
  const locale  = useLocale();
  const { user, hasRole, setUser } = useAuthStore();

  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    if (user && hasRole(Role.ADMIN)) {
      router.replace(`/${locale}/admin`);
    }
  }, [user, hasRole, router, locale]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setLoading(true);
    try {
      const res  = await authApi.login(data);
      const user = (res.data as any)?.data?.user ?? (res.data as any)?.user;
      if (!user) throw new Error('Unexpected response');

      const isAdmin = (user.roles as string[])?.includes('ADMIN');
      if (!isAdmin) {
        setError('This account does not have admin access.');
        try { await authApi.logout(); } catch {}
        return;
      }

      setUser(user);
      router.push(`/${locale}/admin`);
    } catch (err: any) {
      const code = err?.response?.status;
      const msg  = err?.response?.data?.error?.message ?? '';
      if (code === 401 || code === 400) {
        setError('Invalid email or password.');
      } else if (code === 403 && msg.toLowerCase().includes('locked')) {
        setError('Account is locked due to too many failed attempts.');
      } else if (err.message === 'This account does not have admin access.') {
        // already set
      } else {
        setError(error || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#060606',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>

      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(232,184,75,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(232,184,75,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(232,184,75,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div
        className="anim-scale-reveal"
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 420,
          background: '#0d0d0d',
          border: '1px solid #1a1a1a',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top gold bar */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />

        <div style={{ padding: '36px 36px 40px' }}>

          {/* Header */}
          <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, margin: '0 auto 20px',
              background: 'rgba(232,184,75,0.08)',
              border: '1px solid rgba(232,184,75,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={24} color="var(--gold)" />
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem', fontWeight: 400,
              color: 'var(--ivory)', letterSpacing: '-0.02em',
              marginBottom: 6,
            }}>
              Admin Portal
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
              Restricted access — My Music administrators only
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div className="anim-fade-up anim-fade-up-2">
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                {...register('email')}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#111', border: '1px solid #222',
                  borderRadius: 6, color: 'var(--ivory)',
                  fontSize: '0.88rem', fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'}
                onBlur={e => e.currentTarget.style.borderColor = '#222'}
              />
              {errors.email && (
                <p style={{ marginTop: 5, fontSize: '0.72rem', color: '#e07070' }}>{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="anim-fade-up anim-fade-up-3">
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 40px 10px 14px',
                    background: '#111', border: '1px solid #222',
                    borderRadius: 6, color: 'var(--ivory)',
                    fontSize: '0.88rem', fontFamily: 'var(--font-body)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#222'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--muted-text)',
                    cursor: 'pointer', padding: 0, display: 'flex',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ marginTop: 5, fontSize: '0.72rem', color: '#e07070' }}>{errors.password.message}</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="anim-fade-up" style={{
                display: 'flex', alignItems: 'flex-start', gap: 9,
                padding: '12px 14px',
                background: 'rgba(201,76,76,0.07)',
                border: '1px solid rgba(201,76,76,0.2)',
                borderRadius: 6,
              }}>
                <AlertTriangle size={14} color="#e07070" style={{ marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: '0.78rem', color: '#e07070', lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="anim-fade-up anim-fade-up-4" style={{ paddingTop: 4 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: loading ? 'rgba(232,184,75,0.4)' : 'var(--gold)',
                  border: 'none', borderRadius: 6,
                  color: '#0d0d0d', fontSize: '0.85rem', fontWeight: 600,
                  fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s, transform 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(13,13,13,0.3)',
                      borderTopColor: '#0d0d0d',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    Access Admin Portal
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer note */}
          <p className="anim-fade-up anim-fade-up-5" style={{
            marginTop: 24, textAlign: 'center',
            fontSize: '0.68rem', color: '#2a2520', lineHeight: 1.6,
          }}>
            This area is restricted to authorized administrators only.<br />
            Unauthorized access attempts are logged.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
