import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './transform.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { BizCode, BizMessage } from '../enums/biz-code.enum';

const mockReflector = {
  get: jest.fn(),
};

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(async () => {
    mockReflector.get.mockReset();
    mockReflector.get.mockReturnValue(undefined); // 默认无自定义 message

    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    interceptor = module.get<TransformInterceptor<unknown>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  function makeContext(): ExecutionContext {
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
  }

  function makeCallHandler(data: unknown): CallHandler {
    return {
      handle: jest.fn().mockReturnValue(of(data)),
    };
  }

  describe('intercept - 基础包装', () => {
    it('应将响应数据包装为 ApiResponse 格式', (done) => {
      const mockData = { id: 'user-id', name: 'Test User' };
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(mockData));

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: BizCode.SUCCESS,
            data: mockData,
            message: BizMessage[BizCode.SUCCESS],
          });
          done();
        },
      });
    });

    it('null 数据不携带 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(null));

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: BizCode.SUCCESS,
            message: BizMessage[BizCode.SUCCESS],
          });
          expect(result).not.toHaveProperty('data');
          done();
        },
      });
    });

    it('undefined 数据不携带 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(undefined));

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: BizCode.SUCCESS,
            message: BizMessage[BizCode.SUCCESS],
          });
          expect(result).not.toHaveProperty('data');
          done();
        },
      });
    });
  });

  describe('intercept - falsy 但非 null/undefined 的数据应保留 data', () => {
    it('data = 0 时应保留 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(0));

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data', 0);
          done();
        },
      });
    });

    it('data = 空字符串 时应保留 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(''));

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data', '');
          done();
        },
      });
    });

    it('data = false 时应保留 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(false));

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data', false);
          done();
        },
      });
    });

    it('data = 空数组 时应保留 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler([]));

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data');
          expect(result.data).toEqual([]);
          done();
        },
      });
    });

    it('data = 空对象 时应保留 data 字段', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler({}));

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data');
          expect(result.data).toEqual({});
          done();
        },
      });
    });
  });

  describe('intercept - 自定义 ResponseMessage 装饰器', () => {
    it('使用装饰器定义的 message', (done) => {
      mockReflector.get.mockReturnValue('创建成功');
      const result$ = interceptor.intercept(makeContext(), makeCallHandler({ id: 1 }));

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({
            code: BizCode.SUCCESS,
            data: { id: 1 },
            message: '创建成功',
          });
          done();
        },
      });
    });

    it('装饰器返回空字符串时回退到默认消息', (done) => {
      mockReflector.get.mockReturnValue('');
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(null));

      result$.subscribe({
        next: (result) => {
          expect(result.message).toBe(BizMessage[BizCode.SUCCESS]);
          done();
        },
      });
    });

    it('reflector.get 调用时应传入 handler', (done) => {
      const result$ = interceptor.intercept(makeContext(), makeCallHandler(null));

      result$.subscribe({
        next: () => {
          expect(mockReflector.get).toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
