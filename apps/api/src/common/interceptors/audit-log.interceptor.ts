import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Writes an AuditLog row after any admin-only mutating endpoint succeeds.
// Full implementation added in Phase 4B when AuditLog entity + AuditService exist.
//
// Usage (Phase 4B+):
//   Apply @UseInterceptors(AuditLogInterceptor) on admin controller methods.
//   The interceptor reads @CurrentUser() + route metadata to populate
//   adminId, action, targetType, targetId.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        // TODO (Phase 4B): inject AuditService, write AuditLog record
      }),
    );
  }
}
