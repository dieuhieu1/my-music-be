'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Music2, CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { setAdminToken } from '@/lib/utils/cookies';
import { useAuthStore } from '@/store/auth.store';

const FEATURES = [
  'Song approval & content moderation',
  'User management & premium control',
  'Revenue analytics & audit logs',
];

export default function LoginPage() {
  const { setAdminUser } = useAuthStore();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (!res.user.roles.includes('ADMIN')) {
        setError('Invalid credentials or insufficient permissions');
        return;
      }
      setAdminToken(res.accessToken);
      setAdminUser({ id: res.user.id, email: res.user.email, name: res.user.name ?? res.user.email, roles: res.user.roles });
      window.location.href = '/dashboard';
    } catch {
      setError('Invalid credentials or insufficient permissions');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left panel ────────────────────────────────── */}
      <div style={{
        width: '45%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: 60, color: 'white',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 240, height: 240, borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '9999px', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', right: 40, width: 80, height: 80, borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div>
          <Music2 size={48} color="white" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>MyMusic</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Admin Portal</p>
        </div>

        {/* Description */}
        <p style={{ margin: '32px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Manage your music platform with complete control and insights.
        </p>

        {/* Feature list */}
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEATURES.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color="white" strokeWidth={2} />
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────── */}
      <div style={{
        width: '55%', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60,
      }}>
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '100ms', width: '100%', maxWidth: 400 }}
        >
          <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 32px' }}>
            Sign in to your admin account
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 500,
                color: 'var(--text)', marginBottom: 6,
              }}>
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%', height: 42, padding: '0 12px', fontSize: 14,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box', transition: 'all 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 500,
                color: 'var(--text)', marginBottom: 6,
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: 42, padding: '0 40px 0 12px', fontSize: 14,
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', color: 'var(--text)',
                    outline: 'none', boxSizing: 'border-box', transition: 'all 150ms',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', color: 'var(--text-faint)',
                    transition: 'color 150ms',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 16,
                background: 'var(--danger-light)',
                border: '1px solid #FCA5A5',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 42, marginTop: 24,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', border: 'none', borderRadius: 'var(--radius)',
                fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.opacity = '0.92';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(0.99)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
