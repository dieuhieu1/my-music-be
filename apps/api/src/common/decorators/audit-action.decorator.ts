import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action';

export interface AuditActionMeta {
  action: string;
  targetType: string;
}

export const AuditAction = (action: string, targetType: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, targetType } satisfies AuditActionMeta);
