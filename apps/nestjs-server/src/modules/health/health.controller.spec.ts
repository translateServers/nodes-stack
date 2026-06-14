import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from '@/modules/health/health.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';

const mockPrismaService = {
  $queryRaw: jest.fn(),
};

const mockRedisService = {
  ping: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('ping', () => {
    it('should return pong message', () => {
      const result = controller.ping();

      expect(result).toEqual({ message: 'pong' });
    });
  });

  describe('check', () => {
    it('should return status=ok when both database and redis are healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result.redis).toBe('connected');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return status=degraded when database fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedisService.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.database).toBe('disconnected');
      expect(result.redis).toBe('connected');
    });

    it('should return status=degraded when redis fails', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue(false);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.database).toBe('connected');
      expect(result.redis).toBe('disconnected');
    });

    it('should return status=degraded when both fail', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedisService.ping.mockResolvedValue(false);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.database).toBe('disconnected');
      expect(result.redis).toBe('disconnected');
    });

    it('should include timestamp in expected format', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue(true);

      const result = await controller.check();

      // 期望格式: YYYY-MM-DD HH:mm:ss
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should expose uptime in seconds (number)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });
  });
});
