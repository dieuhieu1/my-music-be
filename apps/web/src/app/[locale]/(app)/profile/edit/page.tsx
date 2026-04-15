'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/store/useAuthStore';
import AvatarUpload from '@/components/profile/AvatarUpload';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});
type FormData = z.infer<typeof schema>;

export default function EditProfilePage() {
  const { locale } = useParams<{ locale: string }>();
  const router     = useRouter();
  const { user, setUser } = useAuthStore();

  const [avatarFile, setAvatarFile]   = useState<File | undefined>();
  const [uploading, setUploading]     = useState(false);
  const [saved, setSaved]             = useState(false);
  const [serverError, setServerError] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '' },
  });

  useEffect(() => {
    usersApi.getMe()
      .then((r) => {
        const p = (r.data as any).data ?? r.data;
        setCurrentAvatar(p.avatarUrl);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    setUploading(true);
    setServerError('');
    try {
      const res = await usersApi.updateMe({ name: data.name }, avatarFile);
      const updated = (res.data as any).data ?? res.data;
      if (user) setUser({ ...user, name: updated.name, avatarUrl: updated.avatarUrl });
      setSaved(true);
      setTimeout(() => router.push(`/${locale}/profile`), 1200);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Failed to save changes.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1 mb-8" style={{ marginBottom: 32 }}>
        <Link
          href={`/${locale}/profile`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none',
            marginBottom: 20, letterSpacing: '0.04em',
          }}
        >
          <ArrowLeft size={13} />
          Back to profile
        </Link>

        <p style={{ fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Profile
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em' }}>
          Edit Profile
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>

        {/* Avatar upload */}
        <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ textAlign: 'center' }}>
            <AvatarUpload
              currentUrl={currentAvatar}
              name={user?.name}
              size={110}
              uploading={uploading && !!avatarFile}
              onChange={setAvatarFile}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 12, letterSpacing: '0.04em' }}>
              {avatarFile ? `Ready: ${avatarFile.name}` : 'JPG, PNG or WebP · max 5 MB'}
            </p>
          </div>
        </div>

        {/* Name field */}
        <div className="anim-fade-up anim-fade-up-3 auth-field" style={{ marginBottom: 28 }}>
          <label style={{
            display: 'block', fontSize: '0.68rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10,
          }}>
            Display Name
          </label>
          <input
            {...register('name')}
            type="text"
            autoComplete="name"
            style={{
              width: '100%', padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #2a2520',
              color: 'var(--ivory)',
              fontSize: '1rem',
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          />
          {errors.name && (
            <p style={{ fontSize: '0.72rem', color: '#e07070', marginTop: 6 }}>{errors.name.message}</p>
          )}
        </div>

        {/* Error */}
        {serverError && (
          <div className="anim-fade-up" style={{
            padding: '10px 14px', marginBottom: 20,
            background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)',
            borderRadius: 4, fontSize: '0.8rem', color: '#e07070',
          }}>
            {serverError}
          </div>
        )}

        {/* Submit */}
        <div className="anim-fade-up anim-fade-up-4" style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={uploading || saved}
            className={saved ? '' : 'btn-gold'}
            style={{
              flex: 1, padding: '13px 0',
              borderRadius: 4, border: 'none',
              background: saved ? 'rgba(120,200,120,0.15)' : undefined,
              color: saved ? '#7ac880' : '#0d0d0d',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: saved ? '1px solid rgba(120,200,120,0.3)' : undefined,
            }}
          >
            {uploading ? (
              <><Loader2 size={15} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><Check size={15} /> Saved</>
            ) : (
              'Save Changes'
            )}
          </button>

          <Link
            href={`/${locale}/profile`}
            style={{
              padding: '13px 20px',
              borderRadius: 4,
              border: '1px solid #2a2520',
              color: 'var(--muted-text)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center',
              transition: 'border-color 0.2s, color 0.2s',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
