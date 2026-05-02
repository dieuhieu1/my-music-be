'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Monitor, Smartphone, Users } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { adminApi, type AdminUser, type AdminSession } from '@/lib/api/admin.api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';

// ── Role pill ──────────────────────────────────────────────────────────────

function RolePill({ role }: { role: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    USER:    { bg: 'var(--bg-subtle)',    color: 'var(--text-muted)' },
    ARTIST:  { bg: 'var(--accent-light)', color: 'var(--accent)' },
    ADMIN:   { bg: 'var(--danger-light)', color: 'var(--danger)' },
    PREMIUM: { bg: 'var(--purple-light)', color: 'var(--purple)' },
  };
  const { bg, color } = cfg[role] ?? { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      fontSize: 11, fontWeight: 500,
      background: bg, color,
      marginRight: 4,
    }}>
      {role}
    </span>
  );
}

// ── User avatar (gradient initials) ───────────────────────────────────────

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '9999px', flexShrink: 0,
      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      color: 'white', fontSize: Math.round(size * 0.38), fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  );
}

// ── Role tabs ──────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { key: '',        label: 'All' },
  { key: 'USER',    label: 'User' },
  { key: 'ARTIST',  label: 'Artist' },
  { key: 'ADMIN',   label: 'Admin' },
  { key: 'PREMIUM', label: 'Premium' },
];

const EDITABLE_ROLES = ['USER', 'ARTIST', 'ADMIN', 'PREMIUM'] as const;

// ── Page ───────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { adminUser } = useAuthStore();

  const [roleFilter,  setRoleFilter]  = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [page, setPage]               = useState(1);
  const size = 20;

  const [panelUser, setPanelUser] = useState<AdminUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', roleFilter, search, page, size],
    queryFn: () => adminApi.getUsers({
      role:   roleFilter || undefined,
      search: search || undefined,
      page, size,
    }),
    select: (r) => r.data,
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions', panelUser?.id],
    queryFn: () => adminApi.getUserSessions(panelUser!.id),
    enabled: !!panelUser,
    select: (r) => r.data,
  });

  const updateRoles = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) => adminApi.updateUserRoles(id, roles),
    onSuccess: () => { toast('Roles updated'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError:   () => toast('Failed to update roles', 'error'),
  });

  const revokeSession = useMutation({
    mutationFn: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
      adminApi.deleteUserSession(userId, sessionId),
    onSuccess: () => {
      toast('Session revoked');
      qc.invalidateQueries({ queryKey: ['sessions', panelUser?.id] });
    },
    onError: () => toast('Failed to revoke session', 'error'),
  });

  function openPanel(user: AdminUser) {
    setPanelUser(user);
    setEditRoles([...user.roles]);
  }

  const rolesChanged = panelUser
    ? JSON.stringify([...editRoles].sort()) !== JSON.stringify([...panelUser.roles].sort())
    : false;

  const isSelf = adminUser?.id === panelUser?.id;

  const COLS: Column<AdminUser>[] = [
    {
      key: 'avatar', header: '', width: 52,
      render: (u) => <UserAvatar name={u.name || u.email} />,
    },
    {
      key: 'nameEmail', header: 'Name / Email', width: 'auto',
      render: (u) => (
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{u.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{u.email}</p>
        </div>
      ),
    },
    {
      key: 'roles', header: 'Roles', width: 160,
      render: (u) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {u.roles.map((r) => <RolePill key={r} role={r} />)}
        </div>
      ),
    },
    {
      key: 'premium', header: 'Premium', width: 120,
      render: (u) => u.premiumExpiresAt ? (
        <div>
          <StatusBadge status="PREMIUM" size="sm" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {format(new Date(u.premiumExpiresAt), 'MMM d, yyyy')}
          </p>
        </div>
      ) : (
        <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>—</span>
      ),
    },
    {
      key: 'createdAt', header: 'Joined', width: 110,
      render: (u) => <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{format(new Date(u.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions', header: 'Actions', width: 80,
      render: (u) => (
        <button
          onClick={(e) => { e.stopPropagation(); openPanel(u); }}
          style={{
            height: 28, padding: '0 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12, fontWeight: 500,
            background: 'var(--accent-light)', color: 'var(--accent)',
            border: '1px solid #A5B4FC', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Users</h1>
            {data && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {data.totalItems.toLocaleString()} total
              </p>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
            />
            <input
              placeholder="Search users…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                paddingLeft: 34, paddingRight: 12, height: 38, width: 280, fontSize: 13,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
        </div>

        {/* Role tabs */}
        <div style={{ overflowX: 'auto' }}>
          <StatusTabs
            tabs={ROLE_TABS}
            active={roleFilter}
            onChange={(key) => { setRoleFilter(key); setPage(1); }}
          />
        </div>

        {/* Table */}
        <DataTable
          columns={COLS}
          data={data?.items ?? []}
          rowKey={(u) => u.id}
          loading={isLoading}
          emptyMessage="No users found"
          emptyIcon={Users}
          page={page}
          size={size}
          totalItems={data?.totalItems ?? 0}
          onPageChange={setPage}
          onRowClick={openPanel}
          activeRowId={panelUser?.id}
        />
      </div>

      {/* Slide panel */}
      {panelUser && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setPanelUser(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 49,
            }}
          />

          {/* Panel */}
          <div
            className="animate-slide-in-right"
            style={{
              position: 'fixed', right: 0, top: 0,
              width: 400, height: '100vh',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>User Detail</h3>
              <button
                onClick={() => setPanelUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* User info */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <UserAvatar name={panelUser.name || panelUser.email} size={52} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {panelUser.name}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {panelUser.email}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {panelUser.roles.map((r) => <RolePill key={r} role={r} />)}
              </div>
              {panelUser.premiumExpiresAt && (
                <p style={{ fontSize: 12, color: 'var(--purple)', margin: 0 }}>
                  Premium expires: {format(new Date(panelUser.premiumExpiresAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>

            {/* Role editor */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>
                Roles
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EDITABLE_ROLES.map((role) => {
                  const isDisabled = role === 'ADMIN' && isSelf;
                  return (
                    <label
                      key={role}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        fontSize: 13, color: 'var(--text-muted)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editRoles.includes(role)}
                        disabled={isDisabled}
                        onChange={(e) =>
                          setEditRoles(e.target.checked
                            ? [...editRoles, role]
                            : editRoles.filter((r) => r !== role),
                          )
                        }
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                      />
                      <span>{role}</span>
                      {isDisabled && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>(cannot remove own ADMIN)</span>}
                    </label>
                  );
                })}
              </div>
              {rolesChanged && (
                <button
                  onClick={() => updateRoles.mutate({ id: panelUser.id, roles: editRoles })}
                  disabled={updateRoles.isPending}
                  style={{
                    marginTop: 14, width: '100%', height: 36,
                    borderRadius: 'var(--radius)', background: 'var(--accent)',
                    color: 'white', border: 'none', fontSize: 13, fontWeight: 500,
                    cursor: updateRoles.isPending ? 'not-allowed' : 'pointer',
                    opacity: updateRoles.isPending ? 0.6 : 1, transition: 'opacity 150ms',
                  }}
                >
                  {updateRoles.isPending ? 'Saving…' : 'Save roles'}
                </button>
              )}
            </div>

            {/* Sessions */}
            <div style={{ padding: '16px 24px', flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>
                Active Sessions
              </p>
              {loadingSessions ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-sm)', marginBottom: 8 }} />
                ))
              ) : !sessions?.length ? (
                <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No active sessions</p>
              ) : (
                (sessions as AdminSession[]).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {s.deviceType?.toUpperCase() === 'MOBILE'
                      ? <Smartphone size={16} color="var(--text-muted)" />
                      : <Monitor     size={16} color="var(--text-muted)" />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.deviceName ?? s.deviceType}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
                        {s.ip} · {formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeSession.mutate({ userId: panelUser.id, sessionId: s.id })}
                      style={{
                        background: 'none', border: 'none',
                        fontSize: 12, color: 'var(--danger)',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'text-decoration 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
