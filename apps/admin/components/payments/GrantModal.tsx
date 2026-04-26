'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminUser } from '@/lib/api/admin.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

interface GrantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrantModal({ open, onOpenChange }: GrantModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [durationDays, setDurationDays] = useState('30');
  const [notes, setNotes] = useState('');

  const { data: searchResults } = useQuery({
    queryKey: ['admin', 'users', 'search', userSearch],
    queryFn: async () => (await adminApi.getUserSearch(userSearch)).data,
    enabled: userSearch.length >= 2 && !selectedUser,
    staleTime: 10_000,
  });

  const grantMut = useMutation({
    mutationFn: (dto: { userId: string; durationDays: number; notes?: string }) =>
      adminApi.grantPremium(dto),
    onSuccess: () => {
      toast('Premium granted successfully.', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      onOpenChange(false);
      setSelectedUser(null);
      setUserSearch('');
      setDurationDays('30');
      setNotes('');
    },
    onError: () => toast('Failed to grant premium.', 'error'),
  });

  function handleSubmit() {
    if (!selectedUser || !durationDays) return;
    grantMut.mutate({
      userId: selectedUser.id,
      durationDays: parseInt(durationDays, 10),
      notes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Grant Premium Access" description="Manually grant premium to a user.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedUser ? (
            <div style={{ position: 'relative' }}>
              <Input
                label="User Email"
                placeholder="Search by email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              {searchResults && searchResults.items.length > 0 && userSearch.length >= 2 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {searchResults.items.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => { setSelectedUser(user); setUserSearch(user.email); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 14px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#111827',
                        borderBottom: '1px solid #F3F4F6',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ fontWeight: 500 }}>{user.email}</span>
                      <span style={{ color: '#6B7280', marginLeft: 8 }}>{user.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 8,
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1D4ED8' }}>{selectedUser.email}</p>
                <p style={{ fontSize: 11, color: '#3B82F6' }}>{selectedUser.name}</p>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                style={{ fontSize: 12, color: '#2563EB', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                Change
              </button>
            </div>
          )}

          <Input
            label="Duration (days)"
            type="number"
            min="1"
            max="3650"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for manual grant…"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedUser || !durationDays || grantMut.isPending}
            onClick={handleSubmit}
          >
            {grantMut.isPending ? 'Granting…' : 'Grant Premium'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
