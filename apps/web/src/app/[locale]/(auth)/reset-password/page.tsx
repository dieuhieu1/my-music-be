'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { authApi } from '@/lib/api/auth.api';
import PasswordInput from '@/components/auth/PasswordInput';
import AuthButton from '@/components/auth/AuthButton';
import { CheckCircle } from 'lucide-react';

const schema = z.object({
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/\d/, 'One number')
    .regex(/[\W_]/, 'One special character'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type FormData = z.infer<typeof schema>;

function ResetPasswordContent() {
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const code = params.get('code') ?? '';

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authApi.resetPassword({ email, code, newPassword: data.newPassword });
      setDone(true);
      setTimeout(() => router.push(`/${locale}/login`), 2500);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Failed to reset password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center anim-fade-up">
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <CheckCircle size={28} style={{ color: 'var(--gold)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--ivory)', marginBottom: 10 }}>
          Password reset!
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
          Redirecting you to login…
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="anim-fade-up anim-fade-up-1 mb-10">
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Step 3 of 3
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1.05, color: 'var(--ivory)', marginBottom: 10 }}>
          New password
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="anim-fade-up anim-fade-up-2">
          <PasswordInput label="New password" style={{ width: '100%' }} autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        </div>
        <div className="anim-fade-up anim-fade-up-3">
          <PasswordInput label="Confirm password" style={{ width: '100%' }} autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        </div>

        {serverError && (
          <div style={{
            padding: '10px 14px', background: 'rgba(201,76,76,0.08)',
            border: '1px solid rgba(201,76,76,0.25)', borderRadius: 4,
            fontSize: '0.8rem', color: '#e07070', lineHeight: 1.55,
          }}>
            {serverError}
          </div>
        )}

        <div className="anim-fade-up anim-fade-up-4 pt-2">
          <AuthButton type="submit" loading={loading}>Reset password</AuthButton>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
