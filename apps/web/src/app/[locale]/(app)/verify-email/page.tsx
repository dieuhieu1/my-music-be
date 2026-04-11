'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { authApi } from '@/lib/api/auth.api';
import OtpInput from '@/components/auth/OtpInput';
import AuthButton from '@/components/auth/AuthButton';
import { CheckCircle } from 'lucide-react';

const RESEND_COOLDOWN = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Resend cooldown
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onVerify = async () => {
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.verifyEmail({ email, code });
      setDone(true);
      setTimeout(() => router.push(`/${locale}/login`), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setResendSuccess(false);
    try {
      await authApi.resendVerificationEmail(email);
      setResendSuccess(true);
      setCountdown(RESEND_COOLDOWN);
      setCode('');
      setError('');
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (done) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: 'var(--charcoal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      }}>
        <div className="anim-fade-up" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(232,184,75,0.15)',
          }}>
            <CheckCircle size={32} style={{ color: 'var(--gold)' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 500, color: 'var(--ivory)', marginBottom: 10 }}>
            Email verified!
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  /* ── Main screen ────────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--charcoal)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(ellipse at 60% 20%, rgba(232,184,75,0.04) 0%, transparent 60%), var(--charcoal)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

        {/* Animated email icon */}
        <div className="anim-fade-up anim-fade-up-1 mb-10">
          <div
            className="email-pulse-icon"
            style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'rgba(232,184,75,0.07)',
              border: '1px solid rgba(232,184,75,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z"
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p style={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>
            One more step
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3rem',
            fontWeight: 500,
            lineHeight: 1.05,
            color: 'var(--ivory)',
            marginBottom: 14,
            letterSpacing: '-0.02em',
          }}>
            Verify email
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', lineHeight: 1.7 }}>
            We sent a 6-digit code to<br />
            <span style={{
              color: 'var(--ivory)',
              fontWeight: 500,
              background: 'rgba(232,184,75,0.06)',
              padding: '1px 8px',
              borderRadius: 4,
              border: '1px solid rgba(232,184,75,0.12)',
            }}>
              {email || 'your email'}
            </span>
          </p>
        </div>

        {/* OTP boxes */}
        <div className="anim-fade-up anim-fade-up-2 mb-8">
          <OtpInput value={code} onChange={setCode} error={error} />
        </div>

        {/* Verify button */}
        <div className="anim-fade-up anim-fade-up-3 space-y-5">
          <AuthButton type="button" loading={loading} onClick={onVerify} disabled={code.length < 6}>
            Verify email
          </AuthButton>

          {/* Resend section */}
          <div style={{ paddingTop: 4 }}>
            {resendSuccess && (
              <p style={{
                fontSize: '0.78rem',
                color: '#7aba8a',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}>
                <CheckCircle size={13} />
                New code sent — check your inbox
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>
                Didn&apos;t receive it?
              </span>

              {countdown > 0 ? (
                /* Countdown pill */
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  border: '1px solid #1e1e1e',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  color: 'var(--muted-text)',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Resend in {countdown}s
                </div>
              ) : (
                /* Active resend button */
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    fontSize: '0.8rem',
                    color: resending ? 'var(--muted-text)' : 'var(--gold)',
                    cursor: resending ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(232,184,75,0.4)',
                    textUnderlineOffset: 3,
                    transition: 'color 0.2s',
                  }}
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              )}
            </div>

            {/* Countdown progress bar */}
            {countdown > 0 && (
              <div style={{
                marginTop: 14,
                height: 1,
                background: '#1e1e1e',
                borderRadius: 1,
                overflow: 'hidden',
                width: '60%',
                margin: '14px auto 0',
              }}>
                <div style={{
                  height: '100%',
                  width: `${((RESEND_COOLDOWN - countdown) / RESEND_COOLDOWN) * 100}%`,
                  background: 'var(--gold)',
                  borderRadius: 1,
                  transition: 'width 1s linear',
                  opacity: 0.6,
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Help text */}
        <p className="anim-fade-up anim-fade-up-4" style={{
          marginTop: 32,
          fontSize: '0.72rem',
          color: '#3a3530',
          lineHeight: 1.6,
        }}>
          Check spam if you don&apos;t see it.<br />
          Codes expire after 15 minutes.
        </p>
      </div>
    </div>
  );
}
