import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BusinessException } from '../exceptions/business.exception';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(() => {
    return class MockAuthGuard {
      canActivate() {
        return true;
      }
    };
  }),
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for public routes', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should call super.canActivate for non-public routes', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(false);

      const result = guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should call super.canActivate when isPublic is undefined', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return user when no error and user exists', () => {
      const user = { id: 'user-1', roles: [] };

      const result = guard.handleRequest(null, user);

      expect(result).toBe(user);
    });

    it('should throw BusinessException when err is present', () => {
      expect(() => guard.handleRequest(new Error('auth error'), undefined)).toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined)).toThrow(BusinessException);
    });
  });
});
