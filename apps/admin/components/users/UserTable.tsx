'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { adminApi, type AdminUser, type AdminSession } from '@/lib/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow, Pagination } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import { format } from 'date-fns';

const ALL_ROLES = ['USER', 'ARTIST', 'ADMIN'];

function SessionsRow({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId, 'sessions'],
    queryFn: async () => (await adminApi.getUserSessions(userId)).data as AdminSession[],
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useMutation({
    mutationFn: (sessionId: string) => adminApi.deleteUserSession(userId, sessionId),
    onSuccess: () => { toast('Session revoked.', 'success'); qc.invalidateQueries({ queryKey: ['admin', 'users', userId, 'sessions'] }); },
    onError: () => toast('Failed to revoke session.', 'error'),
  });

  if (isLoading) return <p style={{ fontSize: 12, color: '#6B7280', margin: '8px 0' }}>Loading sessions…</p>;
  if (!data?.length) return <p style={{ fontSize: 12, color: '#6B7280', margin: '8px 0' }}>No active sessions.</p>;

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>
        Active Sessions
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((session) => (
          <div
            key={session.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              backgroundColor: '#F9FAFB',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: '#374151', fontWeight: 500 }}>{session.deviceName ?? session.deviceType}</span>
              <span style={{ color: '#9CA3AF', marginLeft: 8 }}>{session.ip}</span>
              <span style={{ color: '#9CA3AF', marginLeft: 8 }}>
                Last seen: {format(new Date(session.lastSeenAt), 'MMM d, HH:mm')}
              </span>
            </div>
            <button
              onClick={() => deleteMut.mutate(session.id)}
              disabled={deleteMut.isPending}
              style={{
                padding: '3px 6px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#DC2626',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleEditor({ user }: { user: AdminUser }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { adminUser } = useAuthStore();
  const [roles, setRoles] = useState<string[]>(user.roles);

  const updateMut = useMutation({
    mutationFn: (newRoles: string[]) => adminApi.updateUserRoles(user.id, newRoles),
    onSuccess: () => { toast('Roles updated.', 'success'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: () => toast('Failed to update roles.', 'error'),
  });

  function toggle(role: string) {
    if (role === 'ADMIN' && user.id === adminUser?.id) return; // cannot remove own admin
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  const changed = JSON.stringify([...roles].sort()) !== JSON.stringify([...user.roles].sort());

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>
        Roles
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALL_ROLES.map((role) => {
          const active = roles.includes(role);
          const isSelfAdmin = role === 'ADMIN' && user.id === adminUser?.id;
          return (
            <label
              key={role}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: isSelfAdmin ? 'not-allowed' : 'pointer',
                opacity: isSelfAdmin ? 0.6 : 1,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                disabled={isSelfAdmin}
                onChange={() => toggle(role)}
                style={{ accentColor: '#2563EB' }}
              />
              {role}
            </label>
          );
        })}
        {changed && (
          <Button
            size="sm"
            onClick={() => updateMut.mutate(roles)}
            disabled={updateMut.isPending}
          >
            {updateMut.isPending ? 'Saving…' : 'Save Roles'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function UserTable() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', role, search, page],
    queryFn: async () =>
      (await adminApi.getUsers({ role: role || undefined, search: search || undefined, page, size: 20 })).data,
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div style={{ minWidth: 160 }}>
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="ARTIST">Artist</option>
            <option value="USER">User</option>
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input
            type="search"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Roles</Th>
              <Th>Premium</Th>
              <Th>Joined</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={6} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={6} message="No users found." />
            ) : (
              data?.items.flatMap((user) => {
                const expanded = expandedId === user.id;
                return [
                  <Tr key={user.id} onClick={() => setExpandedId(expanded ? null : user.id)}>
                    <Td className="font-medium">{user.email}</Td>
                    <Td>{user.name}</Td>
                    <Td>
                      <div className="flex gap-1 flex-wrap">
                        {user.roles.map((r) => (
                          <Badge key={r} status={r}>{r}</Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      {user.isPremium ? (
                        <Badge status="APPROVED">Yes</Badge>
                      ) : (
                        <Badge status="DISMISSED">No</Badge>
                      )}
                    </Td>
                    <Td className="text-[#9CA3AF] text-xs">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </Td>
                    <Td>
                      <button className="text-[#6B7280] hover:text-[#111827]">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </Td>
                  </Tr>,
                  expanded
                    ? (
                      <tr key={`${user.id}-expand`}>
                        <td
                          colSpan={6}
                          style={{
                            backgroundColor: '#F9FAFB',
                            borderBottom: '1px solid #E5E7EB',
                            padding: '12px 20px',
                          }}
                        >
                          <RoleEditor user={user} />
                          <SessionsRow userId={user.id} />
                        </td>
                      </tr>
                    )
                    : null,
                ].filter(Boolean);
              })
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
