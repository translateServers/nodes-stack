import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '@/modules/health/health.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';

interface HealthBody {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  timestamp: string;
  uptime: number;
}

/**
 * HealthController E2E 测试（HTTP 层）
 *
 * 与 app.e2e-spec.ts 的区别：
 * - 仅加载 HealthController，避开其他模块的副作用（Redis、Prisma 真实连接等）
 * - 不通过 setGlobalPrefix，直接测试原始路由
 */
describe('HealthController (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /ping', () => {
    it('should return pong', async () => {
      const response = await request(app.getHttpServer() as never)
        .get('/ping')
        .expect(200);

      expect(response.body).toEqual({ message: 'pong' });
    });
  });

  describe('GET /', () => {
    it('should return health status (both healthy)', async () => {
      const response = await request(app.getHttpServer() as never)
        .get('/')
        .expect(200);

      const body = response.body as HealthBody;
      expect(body.status).toBe('ok');
      expect(body.database).toBe('connected');
      expect(body.redis).toBe('connected');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.uptime).toBe('number');
    });

    it('should return status=degraded when database fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB down'));

      const response = await request(app.getHttpServer() as never)
        .get('/')
        .expect(200);

      const body = response.body as HealthBody;
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('disconnected');
    });

    it('should return status=degraded when redis fails', async () => {
      mockRedisService.ping.mockResolvedValueOnce(false);

      const response = await request(app.getHttpServer() as never)
        .get('/')
        .expect(200);

      const body = response.body as HealthBody;
      expect(body.status).toBe('degraded');
      expect(body.redis).toBe('disconnected');
    });
  });
});
