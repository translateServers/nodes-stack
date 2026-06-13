import { Test, TestingModule } from '@nestjs/testing';
import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor =
      module.get<TransformInterceptor<unknown>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should transform response to ApiResponse format', (done) => {
      const mockData = { id: 'user-id', name: 'Test User' };
      const mockContext = {
        getHandler: () => ({}),
        switchToHttp: () => ({
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as unknown as ExecutionContext;
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(mockData)),
      };

      const result$: Observable<unknown> = interceptor.intercept(
        mockContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: 0,
            data: mockData,
            message: '操作成功',
          });
          done();
        },
      });
    });

    it('should handle null data', (done) => {
      const mockContext = {
        getHandler: () => ({}),
        switchToHttp: () => ({
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as unknown as ExecutionContext;
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(null)),
      };

      const result$: Observable<unknown> = interceptor.intercept(
        mockContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: 0,
            data: null,
            message: '操作成功',
          });
          done();
        },
      });
    });

    it('should handle undefined data', (done) => {
      const mockContext = {
        getHandler: () => ({}),
        switchToHttp: () => ({
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as unknown as ExecutionContext;
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(undefined)),
      };

      const result$: Observable<unknown> = interceptor.intercept(
        mockContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: 0,
            data: null,
            message: '操作成功',
          });
          done();
        },
      });
    });
  });
});
