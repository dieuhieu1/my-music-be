'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { authApi } from '@/lib/api/auth.api';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import { ArrowLeft } from 'lucide-react';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setEmail(data.email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="anim-fade-up anim-fade-up-1 mb-8">
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(232,184,75,0.1)',
              border: '1px solid rgba(232,184,75,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--ivory)', marginBottom: 10 }}>
            Check your email
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', lineHeight: 1.6 }}>
            We sent a 6-digit code to<br />
            <span style={{ color: 'var(--ivory)' }}>{email}</span>
          </p>
        </div>

        <div className="anim-fade-up anim-fade-up-2">
          <AuthButton
            type="button"
            onClick={() => router.push(`/${locale}/verify-reset?email=${encodeURIComponent(email)}`)}
          >
            Enter code
          </AuthButton>
        </div>

        <p className="anim-fade-up anim-fade-up-3 mt-6" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>
          Didn&apos;t receive it?{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="anim-fade-up anim-fade-up-1 mb-10">
        <Link
          href={`/${locale}/login`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none', marginBottom: 24 }}
        >
          <ArrowLeft size={13} /> Back to login
        </Link>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Account recovery
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1.05, color: 'var(--ivory)', marginBottom: 10 }}>
          Forgot password
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', lineHeight: 1.6 }}>
          Enter your email and we&apos;ll send you a reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="anim-fade-up anim-fade-up-2">
          <AuthInput label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        </div>
        <div className="anim-fade-up anim-fade-up-3 pt-2">
          <AuthButton type="submit" loading={loading}>Send reset code</AuthButton>
        </div>
      </form>
    </div>
  );
}
