import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Catches ALL exceptions and formats them as:
// { success: false, data: null, error: { code, message }, path, timestamp }
//
// HttpExceptions from NestJS (400, 401, 403, 404, 429, …) are forwarded as-is.
// Unexpected errors get 500 + logged with full stack trace.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        // class-validator errors arrive as an array in `message`
        message = Array.isArray(resObj.message)
          ? (resObj.message as string[]).join('; ')
          : String(resObj.message ?? exception.message);
        code = String(resObj.error ?? exception.message);
      } else {
        message = String(res);
        code = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      error: { code, message },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
