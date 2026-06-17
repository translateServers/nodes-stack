import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

function createMockContext(user?: { id: string }): ExecutionContext {
  const req = {
    method: 'GET',
    url: '/api/test',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    user,
  };
  const res = { statusCode: 200 };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

const mockCallHandler: CallHandler = {
  handle: () => of('response-data'),
};

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should pass through and log request/response', (done) => {
    const context = createMockContext({ id: 'user-1' });

    interceptor.intercept(context, mockCallHandler).subscribe({
      next: (value) => {
        expect(value).toBe('response-data');
      },
      complete: () => done(),
    });
  });

  it('should handle anonymous user when req.user is undefined', (done) => {
    const context = createMockContext();

    interceptor.intercept(context, mockCallHandler).subscribe({
      next: (value) => {
        expect(value).toBe('response-data');
      },
      complete: () => done(),
    });
  });
});
