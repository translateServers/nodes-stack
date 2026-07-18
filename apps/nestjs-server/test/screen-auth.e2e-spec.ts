import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { ScreenController } from '@/modules/screen/screen.controller';
import { ScreenService } from '@/modules/screen/screen.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import { TypedConfigService } from '@/config/typed-config.service';
import { PrismaService } from '@/prisma/prisma.service';

interface MockScreenService {
  createProject: jest.Mock;
  findAllProjects: jest.Mock;
  findProjectById: jest.Mock;
  findPublishedProjectById: jest.Mock;
  updateProject: jest.Mock;
  publishProject: jest.Mock;
  removeProject: jest.Mock;
}

interface ApiErrorBody {
  code: number;
  message: string;
  details?: string[];
}

const publishedProject = {
  id: 'published-id',
  name: '已发布大屏',
  description: null,
  canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
  components: [],
  status: 'published',
  thumbnail: null,
  createdAt: '2025-07-16 10:00:00',
  updatedAt: '2025-07-16 10:00:00',
};

/**
 * 大屏 API 匿名访问边界 E2E 测试
 *
 * 验证全局 JwtAuthGuard 对受保护端点的拦截行为:
 * - 列表 / 详情 / 创建 / 更新 / 发布 / 删除 → 401
 * - 公开预览 (已发布) → 200;草稿或不存在 → 404
 *
 * 使用真实的 NestJS 应用实例、真实的 JwtAuthGuard 和 JwtStrategy,
 * 仅 mock 数据库与配置依赖,避免数据库基础设施。
 */
describe('Screen API anonymous access (e2e)', () => {
  let app: INestApplication;
  let screenService: MockScreenService;

  beforeAll(async () => {
    const mockScreenServiceImpl: MockScreenService = {
      createProject: jest.fn(),
      findAllProjects: jest.fn(),
      findProjectById: jest.fn(),
      findPublishedProjectById: jest.fn(),
      updateProject: jest.fn(),
      publishProject: jest.fn(),
      removeProject: jest.fn(),
    };

    const mockPrismaService = {
      user: { findUnique: jest.fn() },
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ScreenController],
      providers: [
        JwtStrategy,
        { provide: TypedConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ScreenService, useValue: mockScreenServiceImpl },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    screenService = moduleFixture.get<MockScreenService>(ScreenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('protected endpoints return 401 for anonymous requests', () => {
    it('GET /screen → 401 (list)', async () => {
      const response = await request(app.getHttpServer() as never).get('/screen');

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.findAllProjects).not.toHaveBeenCalled();
    });

    it('GET /screen/:id → 401 (detail)', async () => {
      const response = await request(app.getHttpServer() as never).get('/screen/some-id');

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.findProjectById).not.toHaveBeenCalled();
    });

    it('POST /screen → 401 (create)', async () => {
      const response = await request(app.getHttpServer() as never)
        .post('/screen')
        .send({ name: '匿名大屏' });

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.createProject).not.toHaveBeenCalled();
    });

    it('PATCH /screen/:id → 401 (update)', async () => {
      const response = await request(app.getHttpServer() as never)
        .patch('/screen/some-id')
        .send({ name: '更新名称', expectedUpdatedAt: '2025-07-16T10:00:00Z' });

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.updateProject).not.toHaveBeenCalled();
    });

    it('POST /screen/:id/publish → 401 (publish)', async () => {
      const response = await request(app.getHttpServer() as never)
        .post('/screen/some-id/publish')
        .send({ expectedUpdatedAt: '2025-07-16T10:00:00Z' });

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.publishProject).not.toHaveBeenCalled();
    });

    it('DELETE /screen/:id → 401 (delete)', async () => {
      const response = await request(app.getHttpServer() as never).delete('/screen/some-id');

      expect(response.status).toBe(401);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.UNAUTHORIZED);
      expect(typeof body.message).toBe('string');
      expect(screenService.removeProject).not.toHaveBeenCalled();
    });
  });

  describe('public preview endpoint does not require authentication', () => {
    it('GET /screen/:id/preview → 200 when project is published', async () => {
      screenService.findPublishedProjectById.mockResolvedValue(publishedProject);

      const response = await request(app.getHttpServer() as never).get(
        '/screen/published-id/preview',
      );

      expect(response.status).toBe(200);
      expect(screenService.findPublishedProjectById).toHaveBeenCalledWith('published-id');
      expect(screenService.findProjectById).not.toHaveBeenCalled();
    });

    it('GET /screen/:id/preview → 404 when project is draft or not found', async () => {
      screenService.findPublishedProjectById.mockRejectedValue(
        new BusinessException(BizCode.SCREEN_NOT_FOUND),
      );

      const response = await request(app.getHttpServer() as never).get('/screen/draft-id/preview');

      expect(response.status).toBe(404);
      const body = response.body as ApiErrorBody;
      expect(body.code).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(typeof body.message).toBe('string');
      expect(screenService.findProjectById).not.toHaveBeenCalled();
    });
  });
});
