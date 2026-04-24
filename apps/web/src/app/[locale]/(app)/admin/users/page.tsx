'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, ChevronLeft, ChevronRight, Search, Shield, Crown,
  Loader2, Check, X,
} from 'lucide-react';
import { adminApi, type AdminUser } from '@/lib/api/admin.api';

const ROLE_OPTS = ['USER', 'ARTIST', 'ADMIN', 'PREMIUM'];

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    ADMIN:   { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)'   },
    ARTIST:  { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)'  },
    PREMIUM: { color: 'rgba(100,180,240,0.9)', bg: 'rgba(100,180,240,0.08)' },
    USER:    { color: 'var(--muted-text)',      bg: 'rgba(42,37,32,0.3)'     },
  };
  const c = map[role] ?? map['USER'];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: '0.6rem',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: c.color, background: c.bg,
      border: `1px solid ${c.color.replace('0.9)', '0.2)')}`,
    }}>
      {role}
    </span>
  );
}

// ── Role editor ───────────────────────────────────────────────────────────────
function RoleEditor({ user, onDone }: { user: AdminUser; onDone: (updated: AdminUser) => void }) {
  const [roles, setRoles] = useState<string[]>([...user.roles]);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (role: string) => {
    if (role === 'USER') return;
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.updateUserRoles(user.id, roles);
      const d = (res.data as any).data ?? res.data;
      onDone(d);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to update roles';
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg));
      setBusy(false);
    }
  };

  return (
    <div className="anim-fade-up" style={{
      marginTop: 12, padding: '14px 16px',
      background: 'rgba(232,184,75,0.03)', border: '1px solid rgba(232,184,75,0.12)',
      borderRadius: 8,
    }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 12 }}>
        Edit roles
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {ROLE_OPTS.map((role) => {
          const active = roles.includes(role);
          const locked = role === 'USER';
          return (
            <button key={role} type="button" onClick={() => toggle(role)} disabled={locked} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.72rem',
              fontFamily: 'var(--font-body)', letterSpacing: '0.06em',
              cursor: locked ? 'not-allowed' : 'pointer',
              background: active ? 'rgba(232,184,75,0.1)' : 'transparent',
              border: `1px solid ${active ? 'rgba(232,184,75,0.35)' : 'rgba(42,37,32,0.6)'}`,
              color: active ? 'var(--gold)' : 'var(--muted-text)',
              opacity: locked ? 0.5 : 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {active && <Check size={11} />}
              {role}
            </button>
          );
        })}
      </div>
      {error && (
        <p style={{ fontSize: '0.74rem', color: 'rgba(220,80,80,0.9)', marginBottom: 10 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={save} disabled={busy} style={{
          padding: '7px 18px', borderRadius: 4,
          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.25)',
          color: 'var(--gold)', fontSize: '0.76rem', fontFamily: 'var(--font-body)',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
        <button type="button" onClick={() => onDone(user)} style={{
          padding: '7px 14px', borderRadius: 4, background: 'transparent',
          border: '1px solid rgba(42,37,32,0.6)', color: 'var(--muted-text)',
          fontSize: '0.76rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ user: initUser, idx }: { user: AdminUser; idx: number }) {
  const [user, setUser]       = useState(initUser);
  const [editing, setEditing] = useState(false);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleDone = (updated: AdminUser) => {
    setUser(updated);
    setEditing(false);
  };

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.18s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.5)')}
    >
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        alignItems: 'center', gap: 16, padding: '14px 20px',
      }}>
        {/* Identity */}
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--ivory)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.displayName}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email} · Joined {fmtDate(user.createdAt)}
          </p>
        </div>

        {/* Roles */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {user.roles.map((r) => <RoleBadge key={r} role={r} />)}
          {user.isPremium && !user.roles.includes('PREMIUM') && <RoleBadge role="PREMIUM" />}
        </div>

        {/* Edit roles */}
        <button type="button" onClick={() => setEditing((v) => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          borderRadius: 4, background: editing ? 'rgba(232,184,75,0.08)' : 'transparent',
          border: `1px solid ${editing ? 'rgba(232,184,75,0.25)' : 'rgba(42,37,32,0.6)'}`,
          color: editing ? 'var(--gold)' : 'var(--muted-text)',
          fontSize: '0.72rem', fontFamily: 'var(--font-body)',
          cursor: 'pointer', letterSpacing: '0.04em',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          flexShrink: 0,
        }}>
          <Shield size={12} /> Roles
        </button>
      </div>

      {editing && (
        <div style={{ padding: '0 20px 16px' }}>
          <RoleEditor user={user} onDone={handleDone} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SIZE = 25;

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async (p: number, q: string, role: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        page: p, size: SIZE,
        search: q || undefined,
        role: role || undefined,
      });
      const d = (res.data as any).data ?? res.data;
      setUsers(Array.isArray(d.items) ? d.items : []);
      setTotal(d.totalItems ?? 0);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, search, roleFilter); }, [load, page, search, roleFilter]);

  const handleSearch = (q: string) => { setSearch(q); setPage(1); };
  const handleRole   = (r: string) => { setRole(r); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(total / SIZE));

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Admin Panel
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem,4vw,2.6rem)',
              fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
            }}>
              Users
            </h1>
            {total > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: 20, marginBottom: 6,
                background: 'rgba(90,85,80,0.15)', border: '1px solid rgba(42,37,32,0.6)',
                fontSize: '0.72rem', color: 'var(--muted-text)', letterSpacing: '0.06em',
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--ivory)' }}>{total}</span>
                {' '}total
              </span>
            )}
          </div>
        </div>

        {/* Search + role filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-text)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name or email…"
              style={{
                padding: '8px 12px 8px 32px', borderRadius: 6,
                background: 'rgba(17,17,17,0.8)', border: '1px solid rgba(42,37,32,0.7)',
                color: 'var(--ivory)', fontSize: '0.78rem', fontFamily: 'var(--font-body)',
                outline: 'none', width: 220,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.7)')}
            />
          </div>

          {['', 'ARTIST', 'ADMIN', 'PREMIUM'].map((role) => (
            <button key={role || 'all'} type="button" onClick={() => handleRole(role)} style={{
              padding: '7px 14px', borderRadius: 4,
              background: roleFilter === role ? 'rgba(232,184,75,0.08)' : 'transparent',
              border: `1px solid ${roleFilter === role ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.6)'}`,
              color: roleFilter === role ? 'var(--gold)' : 'var(--muted-text)',
              fontSize: '0.72rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
              letterSpacing: '0.04em', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}>
              {role || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <div className="vinyl-spin" style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {/* Empty */}
      {!loading && users.length === 0 && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(42,37,32,0.5)', borderRadius: 10,
        }}>
          <Users size={28} color="rgba(90,85,80,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)' }}>
            No users found
          </p>
          {(search || roleFilter) && (
            <button type="button" onClick={() => { setSearch(''); setRole(''); setPage(1); }} style={{
              marginTop: 16, padding: '7px 16px', borderRadius: 4,
              background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
              color: 'var(--muted-text)', fontSize: '0.76rem',
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Column headers */}
      {!loading && users.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto',
          gap: 16, padding: '6px 20px', marginBottom: 8,
          fontSize: '0.58rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(90,85,80,0.5)',
        }}>
          <div>User</div>
          <div>Roles</div>
          <div />
        </div>
      )}

      {/* Users */}
      {!loading && users.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((user, idx) => (
            <UserRow key={user.id} user={user} idx={idx} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 4,
            background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
            color: page === 1 ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
          }}>
            <ChevronLeft size={13} /> Previous
          </button>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted-text)' }}>
            Page <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{page}</span>
            {' '}of <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{totalPages}</span>
          </p>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 4,
            background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
            color: page === totalPages ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
          }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
