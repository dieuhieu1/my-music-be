'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, Check, Loader2, ShieldCheck } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';

const PWD = z.string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/\d/, 'One number')
  .regex(/[\W_]/, 'One special character');

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     PWD,
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

function strengthScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8)      s++;
  if (/[A-Z]/.test(pw))    s++;
  if (/[a-z]/.test(pw))    s++;
  if (/\d/.test(pw))        s++;
  if (/[\W_]/.test(pw))    s++;
  return s;
}

function StrengthBar({ value }: { value: string }) {
  const score = strengthScore(value);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['', '#e07070', '#e0a070', '#e8b84b', '#7ac880', '#50c070'];
  if (!value) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: i <= score ? colors[score] : '#1e1e1e',
            transition: 'background 0.3s',
            animation: i <= score ? 'strengthGrow 0.4s ease both' : undefined,
          }} />
        ))}
      </div>
      <p style={{ fontSize: '0.68rem', color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

function PasswordField({
  label, error, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field" style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          {...props}
          type={show ? 'text' : 'password'}
          style={{
            flex: 1, padding: '12px 0',
            background: 'transparent', border: 'none', borderBottom: '1px solid #2a2520',
            color: 'var(--ivory)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--muted-text)', flexShrink: 0 }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p style={{ fontSize: '0.72rem', color: '#e07070', marginTop: 5 }}>{error}</p>}
    </div>
  );
}

export default function ChangePasswordPage() {
  const { locale } = useParams<{ locale: string }>();
  const router     = useRouter();

  const [loading, setLoading]           = useState(false);
  const [saved, setSaved]               = useState(false);
  const [serverError, setServerError]   = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const newPwd = watch('newPassword', '');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      setSaved(true);
      setTimeout(() => router.push(`/${locale}/profile`), 1400);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <Link
          href={`/${locale}/profile`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={13} /> Back to profile
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ShieldCheck size={16} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.63rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)' }}>Security</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em' }}>
              Change Password
            </h1>
          </div>
        </div>
      </div>

      {saved ? (
        <div className="anim-scale-reveal" style={{
          padding: '32px 24px', textAlign: 'center',
          background: '#111111', border: '1px solid #1a1a1a', borderRadius: 8,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(120,200,120,0.1)', border: '1px solid rgba(120,200,120,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Check size={22} style={{ color: '#7ac880' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--ivory)', marginBottom: 6 }}>Password updated</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Redirecting to your profile…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="anim-fade-up anim-fade-up-2">
            <PasswordField label="Current Password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          </div>

          <div className="anim-fade-up anim-fade-up-3">
            <PasswordField label="New Password" error={errors.newPassword?.message} {...register('newPassword')} />
            <StrengthBar value={newPwd} />
          </div>

          <div className="anim-fade-up anim-fade-up-4" style={{ marginTop: 8 }}>
            <PasswordField label="Confirm New Password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          </div>

          {serverError && (
            <div className="anim-fade-up" style={{
              padding: '10px 14px', marginBottom: 20,
              background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)',
              borderRadius: 4, fontSize: '0.8rem', color: '#e07070',
            }}>
              {serverError}
            </div>
          )}

          <div className="anim-fade-up anim-fade-up-5" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-gold"
              style={{
                flex: 1, padding: '13px 0', borderRadius: 4, border: 'none',
                color: '#0d0d0d', fontSize: '0.85rem', fontFamily: 'var(--font-body)',
                fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : 'Update Password'}
            </button>
            <Link
              href={`/${locale}/profile`}
              style={{
                padding: '13px 20px', borderRadius: 4, border: '1px solid #2a2520',
                color: 'var(--muted-text)', fontSize: '0.85rem', fontFamily: 'var(--font-body)',
                textDecoration: 'none', display: 'flex', alignItems: 'center',
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
