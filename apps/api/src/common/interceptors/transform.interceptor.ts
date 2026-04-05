import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Wraps every successful response in the standard envelope:
// { success: true, data: <original response body> }
//
// Error responses are handled by GlobalExceptionFilter instead.
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { success: true; data: T }> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: true; data: T }> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
