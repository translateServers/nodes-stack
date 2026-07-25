import { Test, type TestingModule } from '@nestjs/testing';
import type { Request as ExpressRequest } from 'express';
import { DatasetController } from '@/modules/dataset/dataset.controller';
import { DatasetService } from '@/modules/dataset/dataset.service';
import type {
  CreateDatasetDto,
  UpdateDatasetDto,
  ExecuteDatasetDto,
  ListDatasetQueryDto,
  DatasetResponse,
  DatasetExecuteResultResponse,
  TestDatasetResultResponse,
  DatasetReferenceCountResponse,
} from '@/modules/dataset/dto/dataset.dto';
import type { UserPayload } from '@/common/interfaces/user.interface';

/**
 * Mock DatasetService 接口
 *
 * 使用独立 interface（而非 jest.Mocked<DatasetService>）定义 mock 方法，
 * 避免 unbound-method 规则误报：jest.Mock 属性访问不会触发该方法规则。
 */
interface MockDatasetService {
  create: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  execute: jest.Mock;
  test: jest.Mock;
  getReferenceCount: jest.Mock;
}

const mockDatasetService: MockDatasetService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  execute: jest.fn(),
  test: jest.fn(),
  getReferenceCount: jest.fn(),
};

/**
 * DatasetController 单元测试
 *
 * 重点测试 controller 层独有职责：
 * - req.user.id 注入到 create
 * - execute 端点 isAnonymous 计算逻辑（req.user 缺失时为匿名）
 *
 * 不测试 service 层业务逻辑（service 已有独立测试）。
 */
describe('DatasetController', () => {
  let controller: DatasetController;
  let service: MockDatasetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasetController],
      providers: [{ provide: DatasetService, useValue: mockDatasetService }],
    }).compile();

    controller = module.get(DatasetController);
    service = module.get<MockDatasetService>(DatasetService);
    jest.clearAllMocks();
  });

  function makeUser(): UserPayload {
    return { id: 'user-1', roles: [] };
  }

  function makeRequest(user?: UserPayload): ExpressRequest & { user?: UserPayload } {
    return { user } as ExpressRequest & { user?: UserPayload };
  }

  describe('create', () => {
    it('应从 req.user 注入 userId 调用 service.create', async () => {
      const dto: CreateDatasetDto = {
        projectId: 'proj-1',
        name: 'ds',
        type: 'static',
        config: { staticData: {} },
      };
      const expected: DatasetResponse = { id: 'ds-1' } as DatasetResponse;
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto, makeRequest(makeUser()));

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toBe(expected);
    });
  });

  describe('findAll', () => {
    it('应透传 query 调用 service.findAll', async () => {
      const query: ListDatasetQueryDto = { projectId: 'proj-1', status: 'active' };
      const expected: DatasetResponse[] = [];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('findOne', () => {
    it('应透传 id 调用 service.findOne', async () => {
      const expected: DatasetResponse = { id: 'ds-1' } as DatasetResponse;
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('ds-1');

      expect(service.findOne).toHaveBeenCalledWith('ds-1');
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('应透传 id 与 dto 调用 service.update', async () => {
      const dto: UpdateDatasetDto = { name: '新名' };
      const expected: DatasetResponse = { id: 'ds-1' } as DatasetResponse;
      service.update.mockResolvedValue(expected);

      const result = await controller.update('ds-1', dto);

      expect(service.update).toHaveBeenCalledWith('ds-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('remove', () => {
    it('应透传 id 调用 service.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('ds-1');

      expect(service.remove).toHaveBeenCalledWith('ds-1');
    });
  });

  describe('execute - isAnonymous 计算', () => {
    const dto: ExecuteDatasetDto = {
      params: {},
      useMock: false,
    };

    it('req.user 存在时 isAnonymous=false（登录用户）', async () => {
      const expected: DatasetExecuteResultResponse = {
        status: 'success',
        raw: {},
        parsed: {},
        meta: { fromCache: false, durationMs: 1 },
      };
      service.execute.mockResolvedValue(expected);

      const result = await controller.execute('ds-1', dto, makeRequest(makeUser()));

      expect(service.execute).toHaveBeenCalledWith('ds-1', dto, false);
      expect(result).toBe(expected);
    });

    it('req.user 为 undefined 时 isAnonymous=true（匿名访问）', async () => {
      const expected: DatasetExecuteResultResponse = {
        status: 'success',
        raw: {},
        parsed: {},
        meta: { fromCache: false, durationMs: 1 },
      };
      service.execute.mockResolvedValue(expected);

      await controller.execute('ds-1', dto, makeRequest(undefined));

      expect(service.execute).toHaveBeenCalledWith('ds-1', dto, true);
    });

    it('req.user 为 undefined 时不应抛出（@Public 端点）', async () => {
      service.execute.mockResolvedValue({
        status: 'success',
        raw: null,
        parsed: null,
        meta: { fromCache: false, durationMs: 0 },
      });

      await expect(controller.execute('ds-1', dto, makeRequest(undefined))).resolves.toBeDefined();
    });
  });

  describe('test', () => {
    it('应透传 id 与 dto 调用 service.test', async () => {
      const dto: ExecuteDatasetDto = {
        params: {},
        useMock: false,
      };
      const expected: TestDatasetResultResponse = {
        status: 'success',
        raw: {},
        parsed: {},
        meta: { fromCache: false, durationMs: 1 },
      };
      service.test.mockResolvedValue(expected);

      const result = await controller.test('ds-1', dto);

      expect(service.test).toHaveBeenCalledWith('ds-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('getReferenceCount', () => {
    it('应透传 id 调用 service.getReferenceCount', async () => {
      const expected: DatasetReferenceCountResponse = {
        datasetId: 'ds-1',
        count: 3,
      };
      service.getReferenceCount.mockResolvedValue(expected);

      const result = await controller.getReferenceCount('ds-1');

      expect(service.getReferenceCount).toHaveBeenCalledWith('ds-1');
      expect(result).toBe(expected);
    });
  });
});
