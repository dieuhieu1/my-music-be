'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { authApi } from '@/lib/api/auth.api';
import OtpInput from '@/components/auth/OtpInput';
import AuthButton from '@/components/auth/AuthButton';

function VerifyResetContent() {
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onVerify = async () => {
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.verifyCode({ email, code });
      router.push(`/${locale}/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <div className="anim-fade-up anim-fade-up-1 mb-10">
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Step 2 of 3
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1.05, color: 'var(--ivory)', marginBottom: 10 }}>
          Enter code
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', lineHeight: 1.6 }}>
          We sent a 6-digit code to<br />
          <span style={{ color: 'var(--ivory)' }}>{email || 'your email'}</span>
        </p>
      </div>

      <div className="anim-fade-up anim-fade-up-2 mb-8">
        <OtpInput value={code} onChange={setCode} error={error} />
      </div>

      <div className="anim-fade-up anim-fade-up-3 space-y-3">
        <AuthButton type="button" loading={loading} onClick={onVerify} disabled={code.length < 6}>
          Verify code
        </AuthButton>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: '100%', padding: '10px 0', background: 'none', border: 'none',
            fontSize: '0.8rem', color: 'var(--muted-text)', cursor: 'pointer',
          }}
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}

export default function VerifyResetPage() {
  return (
    <Suspense fallback={null}>
      <VerifyResetContent />
    </Suspense>
  );
}
