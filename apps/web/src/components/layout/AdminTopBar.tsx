'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/lib/api/auth.api';
import { getAssetUrl } from '@/lib/utils/asset';

export default function AdminTopBar() {
  const { locale }      = useParams<{ locale: string }>();
  const router          = useRouter();
  const { user, clearUser } = useAuthStore();

  const [open, setOpen]   = useState(false);
  const dropdownRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push(`/${locale}/admin-login`);
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 52, flexShrink: 0,
      backgroundColor: '#060606',
      borderBottom: '1px solid #111',
    }}>

      {/* Left: branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Shield size={16} color="var(--gold)" style={{ opacity: 0.8 }} />
        <span style={{
          fontSize: '0.82rem', fontWeight: 600,
          color: 'var(--ivory)', letterSpacing: '0.04em',
          fontFamily: 'var(--font-body)',
        }}>
          Admin Portal
        </span>
        <span style={{
          padding: '2px 8px',
          background: 'rgba(232,184,75,0.08)',
          border: '1px solid rgba(232,184,75,0.18)',
          borderRadius: 4,
          fontSize: '0.58rem', letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--gold)',
          fontFamily: 'var(--font-body)',
        }}>
          My Music
        </span>
      </div>

      {/* Right: user */}
      {user && (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px 5px 6px', borderRadius: 20,
              background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: '1px solid ' + (open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'),
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
          >
            {user.avatarUrl ? (
              <img
                src={getAssetUrl(user.avatarUrl)} alt={user.name}
                style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(232,184,75,0.12)',
                border: '1px solid rgba(232,184,75,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: 'var(--gold)',
              }}>
                {initials}
              </div>
            )}
            <span style={{ fontSize: '0.78rem', color: 'var(--muted-text)', fontFamily: 'var(--font-body)' }}>
              {user.name}
            </span>
            <ChevronDown size={12} style={{
              color: 'var(--muted-text)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }} />
          </button>

          {open && (
            <div
              className="anim-fade-up"
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 180, borderRadius: 6, overflow: 'hidden',
                background: '#131313', border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--ivory)', fontWeight: 500 }}>{user.name}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', marginTop: 2 }}>Administrator</p>
              </div>
              <div style={{ padding: '6px 0' }}>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 14px', background: 'none', border: 'none',
                    color: 'var(--muted-text)', fontSize: '0.78rem',
                    fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#e07070';
                    e.currentTarget.style.background = 'rgba(220,80,80,0.06)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--muted-text)';
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
