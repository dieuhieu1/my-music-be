import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_ACTION_KEY, AuditActionMeta } from '../decorators/audit-action.decorator';

// Writes an AuditLog row after any admin endpoint decorated with @AuditAction() succeeds.
// AdminService also calls AuditService.log() directly for critical mutations.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditActionMeta>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{ user?: { id?: string }; params?: Record<string, string> }>();
    const adminId = req.user?.id;
    const targetId = req.params?.['id'] ?? null;

    return next.handle().pipe(
      tap(() => {
        if (!adminId) return;
        this.auditService
          .log(adminId, meta.action, meta.targetType, targetId ?? undefined)
          .catch(() => undefined);
      }),
    );
  }
}
