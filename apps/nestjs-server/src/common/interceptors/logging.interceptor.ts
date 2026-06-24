import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import type { Response } from 'express';
import type { RequestWithUser } from '../guards/jwt-auth.guard';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();

    const { method, url, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const userId = req.user?.id ?? 'anonymous';
    const startTime = Date.now();

    this.logger.log(`${method} ${url} - User: ${userId} - IP: ${ip} - UA: ${userAgent}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms - User: ${userId}`);
      }),
    );
  }
}
