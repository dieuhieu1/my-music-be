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
import PasswordInput from '@/components/auth/PasswordInput';
import AuthButton from '@/components/auth/AuthButton';

const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'One uppercase letter required')
  .regex(/[a-z]/, 'One lowercase letter required')
  .regex(/\d/, 'One number required')
  .regex(/[\W_]/, 'One special character required');

const baseFields = z.object({
  name: z.string().min(2, 'Full name required'),
  email: z.string().email('Enter a valid email'),
  password: passwordRule,
  confirmPassword: z.string(),
});

const userSchema = baseFields.refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const artistSchema = baseFields.extend({
  stageName: z.string().min(2, 'Stage name required'),
  bio: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type UserForm = z.infer<typeof userSchema>;
type ArtistForm = z.infer<typeof artistSchema>;

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 0',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
        color: active ? 'var(--gold)' : 'var(--muted-text)',
        fontSize: '0.78rem',
        fontFamily: 'var(--font-body)',
        fontWeight: active ? 600 : 400,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </button>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const [role, setRole] = useState<'user' | 'artist'>('user');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const userForm = useForm<UserForm>({ resolver: zodResolver(userSchema) });
  const artistForm = useForm<ArtistForm>({ resolver: zodResolver(artistSchema) });

  const onSubmitUser = async (data: UserForm) => {
    setServerError('');
    setLoading(true);
    try {
      await authApi.registerUser({ name: data.name, email: data.email, password: data.password });
      router.push(`/${locale}/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitArtist = async (data: ArtistForm) => {
    setServerError('');
    setLoading(true);
    try {
      await authApi.registerArtist({
        name: data.name,
        email: data.email,
        password: data.password,
        stageName: data.stageName,
        bio: data.bio ?? '',
        genreIds: [],
      });
      router.push(`/${locale}/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const isUser = role === 'user';
  const uf = userForm;
  const af = artistForm;

  return (
    <div>
      {/* Heading */}
      <div className="anim-fade-up anim-fade-up-1 mb-8">
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Get started
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1.05, color: 'var(--ivory)', marginBottom: 10 }}>
          Create account
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
          Already have an account?{' '}
          <Link href={`/${locale}/login`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>

      {/* Role tabs */}
      <div className="anim-fade-up anim-fade-up-2 flex mb-8" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <Tab active={isUser} onClick={() => { setRole('user'); setServerError(''); }}>
          Listener
        </Tab>
        <Tab active={!isUser} onClick={() => { setRole('artist'); setServerError(''); }}>
          Artist
        </Tab>
      </div>

      {/* USER FORM */}
      {isUser && (
        <form onSubmit={uf.handleSubmit(onSubmitUser)} className="space-y-5">
          <div className="anim-fade-up anim-fade-up-3">
            <AuthInput label="Full name" placeholder="Your full name" error={uf.formState.errors.name?.message} {...uf.register('name')} />
          </div>
          <div className="anim-fade-up anim-fade-up-4">
            <AuthInput label="Email" type="email" placeholder="you@example.com" error={uf.formState.errors.email?.message} {...uf.register('email')} />
          </div>
          <div className="anim-fade-up anim-fade-up-5">
            <PasswordInput label="Password" autoComplete="new-password" error={uf.formState.errors.password?.message} {...uf.register('password')} />
          </div>
          <div className="anim-fade-up anim-fade-up-6">
            <PasswordInput label="Confirm password" autoComplete="new-password" error={uf.formState.errors.confirmPassword?.message} {...uf.register('confirmPassword')} />
          </div>

          {serverError && <ErrorBox message={serverError} />}

          <div className="anim-fade-up anim-fade-up-7 pt-2">
            <AuthButton type="submit" loading={loading}>Create account</AuthButton>
          </div>
        </form>
      )}

      {/* ARTIST FORM */}
      {!isUser && (
        <form onSubmit={af.handleSubmit(onSubmitArtist)} className="space-y-5">
          <div className="anim-fade-up anim-fade-up-3">
            <AuthInput label="Full name" placeholder="Your full name" error={af.formState.errors.name?.message} {...af.register('name')} />
          </div>
          <div className="anim-fade-up anim-fade-up-4">
            <AuthInput label="Stage name" placeholder="How you appear to fans" error={af.formState.errors.stageName?.message} {...af.register('stageName')} />
          </div>
          <div className="anim-fade-up anim-fade-up-4">
            <AuthInput label="Email" type="email" placeholder="you@example.com" error={af.formState.errors.email?.message} {...af.register('email')} />
          </div>
          <div className="anim-fade-up anim-fade-up-5">
            <AuthInput
              label="Bio (optional)"
              placeholder="A short intro about you"
              error={(af.formState.errors as any).bio?.message}
              {...af.register('bio')}
            />
          </div>
          <div className="anim-fade-up anim-fade-up-6">
            <PasswordInput label="Password" autoComplete="new-password" error={af.formState.errors.password?.message} {...af.register('password')} />
          </div>
          <div className="anim-fade-up anim-fade-up-7">
            <PasswordInput label="Confirm password" autoComplete="new-password" error={af.formState.errors.confirmPassword?.message} {...af.register('confirmPassword')} />
          </div>

          {serverError && <ErrorBox message={serverError} />}

          <div className="anim-fade-up anim-fade-up-8 pt-2">
            <AuthButton type="submit" loading={loading}>Create artist account</AuthButton>
          </div>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(201,76,76,0.08)',
      border: '1px solid rgba(201,76,76,0.25)',
      borderRadius: 4,
      fontSize: '0.8rem',
      color: '#e07070',
      lineHeight: 1.55,
    }}>
      {message}
    </div>
  );
}
