import { Test, type TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { TypedConfigService } from '@/config/typed-config.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockConfigService = { get: jest.fn().mockReturnValue('test-jwt-secret') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: TypedConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('configuration', () => {
    it('should read jwt secret from config during construction', async () => {
      // 单独创建新实例，断言构造期间对 config.get 的调用
      const freshGet = jest.fn().mockReturnValue('another-secret');
      await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: TypedConfigService, useValue: { get: freshGet } },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      expect(freshGet).toHaveBeenCalledWith('jwt.secret');
    });
  });

  describe('validate', () => {
    it('should return user with roles when user exists', async () => {
      const payload = { sub: 'user-id' };
      const dbUser = {
        id: 'user-id',
        roles: [
          { id: 'role-1', name: 'admin' },
          { id: 'role-2', name: 'user' },
        ],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(dbUser);

      const result = await strategy.validate(payload);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          roles: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual({
        id: 'user-id',
        roles: [
          { id: 'role-1', name: 'admin' },
          { id: 'role-2', name: 'user' },
        ],
      });
    });

    it('should return empty roles array when user not found', async () => {
      const payload = { sub: 'deleted-user-id' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: 'deleted-user-id', roles: [] });
    });

    it('should return user with empty roles when user has no roles', async () => {
      const payload = { sub: 'user-id' };
      const dbUser = { id: 'user-id', roles: [] };
      mockPrismaService.user.findUnique.mockResolvedValue(dbUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: 'user-id', roles: [] });
    });

    it('should map role shape correctly (id, name only)', async () => {
      const payload = { sub: 'user-id' };
      const dbUser = {
        id: 'user-id',
        roles: [{ id: 'r1', name: 'admin' }],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(dbUser);

      const result = await strategy.validate(payload);

      // 确保只透传 id 和 name 字段
      expect(result.roles[0]).toEqual({ id: 'r1', name: 'admin' });
      expect(Object.keys(result.roles[0])).toEqual(['id', 'name']);
    });
  });
});
