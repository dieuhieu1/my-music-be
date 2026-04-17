'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, Loader2, Plus, Trash2, Mic2, ExternalLink } from 'lucide-react';
import { artistApi, type SocialLink } from '@/lib/api/artist.api';
import { useAuthStore } from '@/store/useAuthStore';
import AvatarUpload from '@/components/profile/AvatarUpload';

const PLATFORM_OPTIONS = ['spotify', 'soundcloud', 'youtube', 'instagram', 'twitter', 'tiktok', 'website'];

const schema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100),
  bio:        z.string().max(1000, 'Max 1000 characters').optional(),
  socialLinks: z.array(z.object({
    platform: z.string().min(1, 'Platform required'),
    url:      z.string().url('Must be a valid URL'),
  })).optional(),
});
type FormData = z.infer<typeof schema>;

export default function EditArtistProfilePage() {
  const { locale } = useParams<{ locale: string }>();
  const router     = useRouter();
  const { user }   = useAuthStore();

  const [avatarFile, setAvatarFile]   = useState<File | undefined>();
  const [uploading, setUploading]     = useState(false);
  const [saved, setSaved]             = useState(false);
  const [serverError, setServerError] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [bioLength, setBioLength]     = useState(0);

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stageName: '', bio: '', socialLinks: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'socialLinks' });

  const bioValue = watch('bio', '');

  useEffect(() => {
    setBioLength((bioValue ?? '').length);
  }, [bioValue]);

  // Load current profile
  useEffect(() => {
    if (!user?.id) return;
    artistApi.getArtistProfile(user.id)
      .then((r) => {
        const data = (r.data as any).data ?? r.data;
        setCurrentAvatar(data.avatarUrl ?? null);
        reset({
          stageName:   data.stageName ?? '',
          bio:         data.bio ?? '',
          socialLinks: (data.socialLinks ?? []) as SocialLink[],
        });
      })
      .catch(() => {});
  }, [user?.id, reset]);

  const onSubmit = async (data: FormData) => {
    setUploading(true);
    setServerError('');
    try {
      await artistApi.updateMyProfile(
        {
          stageName:   data.stageName,
          bio:         data.bio,
          socialLinks: data.socialLinks as SocialLink[],
        },
        avatarFile,
      );
      setSaved(true);
      setTimeout(() => router.push(`/${locale}/artist/profile`), 1200);
    } catch (err: any) {
      setServerError(err?.response?.data?.error?.message ?? 'Failed to save changes.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <Link
          href={`/${locale}/artist/profile`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '0.75rem', color: 'var(--muted-text)', textDecoration: 'none',
            marginBottom: 20, letterSpacing: '0.04em',
          }}
        >
          <ArrowLeft size={13} /> Back to my profile
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Mic2 size={16} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.63rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Artist
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em' }}>
              Edit Profile
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>

        {/* ── Avatar ───────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ textAlign: 'center' }}>
            <AvatarUpload
              currentUrl={currentAvatar}
              name={watch('stageName')}
              size={110}
              uploading={uploading && !!avatarFile}
              onChange={setAvatarFile}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 12, letterSpacing: '0.04em' }}>
              {avatarFile ? `Ready: ${avatarFile.name}` : 'JPG, PNG or WebP · max 5 MB'}
            </p>
          </div>
        </div>

        {/* ── Stage name ───────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-3 auth-field" style={{ marginBottom: 28 }}>
          <label style={{
            display: 'block', fontSize: '0.68rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 10,
          }}>
            Stage Name
          </label>
          <input
            {...register('stageName')}
            type="text"
            autoComplete="off"
            style={{
              width: '100%', padding: '12px 0',
              background: 'transparent', border: 'none',
              borderBottom: '1px solid #2a2520',
              color: 'var(--ivory)', fontSize: '1rem',
              fontFamily: 'var(--font-body)', outline: 'none',
            }}
          />
          {errors.stageName && (
            <p style={{ fontSize: '0.72rem', color: '#e07070', marginTop: 6 }}>{errors.stageName.message}</p>
          )}
        </div>

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-4 auth-field" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{
              fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--muted-text)',
            }}>
              Bio
            </label>
            <span style={{ fontSize: '0.65rem', color: bioLength > 900 ? '#e0a070' : 'var(--muted-text)' }}>
              {bioLength}/1000
            </span>
          </div>
          <textarea
            {...register('bio')}
            rows={5}
            placeholder="Tell listeners about your music, your story…"
            style={{
              width: '100%', padding: '12px 0',
              background: 'transparent', border: 'none',
              borderBottom: '1px solid #2a2520',
              color: 'var(--ivory)', fontSize: '0.92rem',
              fontFamily: 'var(--font-body)', outline: 'none',
              resize: 'vertical', lineHeight: 1.7,
            }}
          />
          {errors.bio && (
            <p style={{ fontSize: '0.72rem', color: '#e07070', marginTop: 6 }}>{errors.bio.message}</p>
          )}
        </div>

        {/* ── Social links ─────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-5" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <label style={{
              fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--muted-text)',
            }}>
              Social Links
            </label>
            <button
              type="button"
              onClick={() => append({ platform: 'spotify', url: '' })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px',
                background: 'rgba(232,184,75,0.06)',
                border: '1px solid rgba(232,184,75,0.18)',
                borderRadius: 3,
                color: 'var(--gold)',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {fields.length === 0 && (
            <div style={{
              padding: '18px 16px', textAlign: 'center',
              border: '1px dashed #1e1e1e', borderRadius: 6,
            }}>
              <ExternalLink size={20} style={{ color: 'rgba(232,184,75,0.15)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                No links yet — add Spotify, YouTube, Instagram…
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="anim-fade-up"
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '14px 16px',
                  background: '#111111',
                  border: '1px solid #1a1a1a',
                  borderRadius: 6,
                }}
              >
                {/* Platform select */}
                <div style={{ width: 120, flexShrink: 0 }}>
                  <select
                    {...register(`socialLinks.${index}.platform`)}
                    style={{
                      width: '100%', padding: '8px 0',
                      background: 'transparent',
                      border: 'none', borderBottom: '1px solid #2a2520',
                      color: 'var(--ivory)', fontSize: '0.8rem',
                      fontFamily: 'var(--font-body)',
                      outline: 'none', cursor: 'pointer',
                      appearance: 'none', WebkitAppearance: 'none',
                      textTransform: 'capitalize',
                    }}
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p} value={p} style={{ background: '#0d0d0d', textTransform: 'capitalize' }}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {errors.socialLinks?.[index]?.platform && (
                    <p style={{ fontSize: '0.65rem', color: '#e07070', marginTop: 3 }}>
                      {errors.socialLinks[index]?.platform?.message}
                    </p>
                  )}
                </div>

                {/* URL input */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    {...register(`socialLinks.${index}.url`)}
                    type="url"
                    placeholder="https://…"
                    style={{
                      width: '100%', padding: '8px 0',
                      background: 'transparent',
                      border: 'none', borderBottom: '1px solid #2a2520',
                      color: 'var(--ivory)', fontSize: '0.8rem',
                      fontFamily: 'var(--font-body)', outline: 'none',
                    }}
                  />
                  {errors.socialLinks?.[index]?.url && (
                    <p style={{ fontSize: '0.65rem', color: '#e07070', marginTop: 3 }}>
                      {errors.socialLinks[index]?.url?.message}
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  style={{
                    background: 'none', border: 'none',
                    padding: '8px 4px', cursor: 'pointer',
                    color: 'var(--muted-text)', flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#e07070')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted-text)')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Server error ─────────────────────────────────────────────── */}
        {serverError && (
          <div className="anim-fade-up" style={{
            padding: '10px 14px', marginBottom: 20,
            background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.25)',
            borderRadius: 4, fontSize: '0.8rem', color: '#e07070',
          }}>
            {serverError}
          </div>
        )}

        {/* ── Buttons ──────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-6" style={{ display: 'flex', gap: 10 }}>
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
              ...(saved ? { border: '1px solid rgba(120,200,120,0.3)' } : {}),
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
            href={`/${locale}/artist/profile`}
            style={{
              padding: '13px 20px',
              borderRadius: 4,
              border: '1px solid #2a2520',
              color: 'var(--muted-text)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
