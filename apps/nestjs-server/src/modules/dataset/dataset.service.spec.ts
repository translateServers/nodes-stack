import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetService } from '@/modules/dataset/dataset.service';
import { DatasetCacheService } from '@/modules/dataset/dataset-cache.service';
import { DatasetFilterService } from '@/modules/dataset/dataset-filter.service';
import { DatasetMockService } from '@/modules/dataset/dataset-mock.service';
import { StaticExecutor } from '@/modules/dataset/executors/static.executor';
import { ApiExecutor } from '@/modules/dataset/executors/api.executor';
import { UnsupportedExecutor } from '@/modules/dataset/executors/unsupported.executor';
import type { CreateDatasetDto, UpdateDatasetDto } from '@/modules/dataset/dto/dataset.dto';

/**
 * DatasetService 单元测试
 *
 * 覆盖业务约束与边界条件，不测框架能力：
 * - CRUD：项目存在性 / 名称唯一 / 字段写入 / 缓存失效
 * - execute：mock 覆盖语义、匿名访问保护、缓存命中、执行器分发、filter+dataPath、写缓存
 * - test：mock 分支、执行器测试分支
 * - remove：引用校验、删除后缓存失效
 */
describe('DatasetService', () => {
  let service: DatasetService;
  let prisma: {
    screenProject: { findUnique: jest.Mock };
    dataset: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    invalidateDataset: jest.Mock;
  };
  let filterService: { applyFilter: jest.Mock };
  let mockService: { generate: jest.Mock };
  let staticExecutor: { execute: jest.Mock; test: jest.Mock };
  let apiExecutor: { execute: jest.Mock; test: jest.Mock };
  let unsupportedExecutor: { execute: jest.Mock; test: jest.Mock };

  beforeEach(async () => {
    prisma = {
      screenProject: { findUnique: jest.fn() },
      dataset: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidateDataset: jest.fn(),
    };
    filterService = { applyFilter: jest.fn() };
    mockService = { generate: jest.fn() };
    staticExecutor = { execute: jest.fn(), test: jest.fn() };
    apiExecutor = { execute: jest.fn(), test: jest.fn() };
    unsupportedExecutor = { execute: jest.fn(), test: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetService,
        { provide: PrismaService, useValue: prisma },
        { provide: DatasetCacheService, useValue: cacheService },
        { provide: DatasetFilterService, useValue: filterService },
        { provide: DatasetMockService, useValue: mockService },
        { provide: StaticExecutor, useValue: staticExecutor },
        { provide: ApiExecutor, useValue: apiExecutor },
        { provide: UnsupportedExecutor, useValue: unsupportedExecutor },
      ],
    }).compile();

    service = module.get(DatasetService);
  });

  /** 构造一个 Prisma Dataset 实体（已序列化 JSON 字段） */
  function makeEntity(
    overrides: Partial<{
      id: string;
      projectId: string;
      name: string;
      type: string;
      config: unknown;
      tags: string[];
      shape: unknown;
      cache: unknown;
      mock: unknown;
      status: string;
    }> = {},
  ): Record<string, unknown> {
    const type = overrides.type ?? 'static';
    // config 必须包含 type 字段（与 DatasetConfigSchema 判别联合一致），
    // 否则 toResponse 中 DatasetResponseSchema.parse 会失败
    const defaultConfig =
      type === 'static'
        ? { type: 'static', staticData: { list: [1, 2, 3] } }
        : type === 'api'
          ? { type: 'api', path: 'https://api.example.com', method: 'GET', contentType: 'json' }
          : type === 'sql'
            ? { type: 'sql', connectionId: 'c1', sql: 'select 1' }
            : { type: 'websocket', url: 'wss://x', messageFormat: 'json' };
    const config = overrides.config ?? defaultConfig;
    return {
      id: overrides.id ?? 'ds-1',
      projectId: overrides.projectId ?? 'proj-1',
      name: overrides.name ?? '数据集1',
      description: null,
      type,
      category: null,
      tags: overrides.tags ? JSON.stringify(overrides.tags) : null,
      config: JSON.stringify(config),
      shape: overrides.shape ? JSON.stringify(overrides.shape) : null,
      refresh: null,
      cache: overrides.cache ? JSON.stringify(overrides.cache) : null,
      mock: overrides.mock ? JSON.stringify(overrides.mock) : null,
      status: overrides.status ?? 'active',
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
  }

  /** 构造带 project 关联的实体（execute 用） */
  function makeEntityWithProject(
    entityOverrides: Parameters<typeof makeEntity>[0] = {},
    projectStatus = 'published',
  ): Record<string, unknown> {
    return {
      ...makeEntity(entityOverrides),
      project: { id: entityOverrides.projectId ?? 'proj-1', status: projectStatus },
    };
  }

  // ===== create =====

  describe('create', () => {
    it('项目不存在应抛 SCREEN_NOT_FOUND', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(null);

      const dto: CreateDatasetDto = {
        projectId: 'proj-x',
        name: 'ds',
        type: 'static',
        config: { staticData: {} },
      };

      await expect(service.create(dto, 'user-1')).rejects.toMatchObject({
        bizCode: BizCode.SCREEN_NOT_FOUND,
      });
      expect(prisma.dataset.create).not.toHaveBeenCalled();
    });

    it('名称已存在应抛 DATASET_NAME_EXISTS', async () => {
      prisma.screenProject.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ name: '同名' }));

      const dto: CreateDatasetDto = {
        projectId: 'proj-1',
        name: '同名',
        type: 'static',
        config: { staticData: {} },
      };

      await expect(service.create(dto, 'user-1')).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NAME_EXISTS,
      });
      expect(prisma.dataset.create).not.toHaveBeenCalled();
    });

    it('正常创建应序列化 JSON 字段并返回响应', async () => {
      prisma.screenProject.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.dataset.findUnique.mockResolvedValue(null);
      const created = makeEntity({ id: 'ds-new', name: '新数据集' });
      prisma.dataset.create.mockResolvedValue(created);

      const dto: CreateDatasetDto = {
        projectId: 'proj-1',
        name: '新数据集',
        type: 'static',
        description: '描述',
        tags: ['销售', '实时'],
        config: { staticData: { x: 1 } },
      };

      const result = await service.create(dto, 'user-1');

      // 校验写入字段
      expect(prisma.dataset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: '新数据集',
          description: '描述',
          type: 'static',
          tags: JSON.stringify(['销售', '实时']),
          config: JSON.stringify({ staticData: { x: 1 } }),
          status: 'active',
          createdBy: 'user-1',
        }) as object,
      });
      // 校验响应
      expect(result.id).toBe('ds-new');
      expect(result.projectId).toBe('proj-1');
      expect(result.name).toBe('新数据集');
      expect(result.type).toBe('static');
    });

    it('tags 为 undefined 时应写入 null', async () => {
      prisma.screenProject.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.dataset.findUnique.mockResolvedValue(null);
      prisma.dataset.create.mockResolvedValue(makeEntity());

      const dto: CreateDatasetDto = {
        projectId: 'proj-1',
        name: '无标签',
        type: 'static',
        config: { staticData: {} },
      };

      await service.create(dto, 'user-1');

      expect(prisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: null,
          }) as object,
        }) as object,
      );
    });
  });

  // ===== findAll / findOne =====

  describe('findAll', () => {
    it('应按 projectId 过滤并返回列表', async () => {
      prisma.dataset.findMany.mockResolvedValue([makeEntity({ id: 'ds-1' })]);

      const result = await service.findAll({ projectId: 'proj-1' });

      expect(prisma.dataset.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ds-1');
    });

    it('应支持 status 和 type 过滤', async () => {
      prisma.dataset.findMany.mockResolvedValue([]);

      await service.findAll({ projectId: 'proj-1', status: 'active', type: 'api' });

      expect(prisma.dataset.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', status: 'active', type: 'api' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('不存在应抛 DATASET_NOT_FOUND', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ds-x')).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NOT_FOUND,
      });
    });

    it('应返回响应', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));

      const result = await service.findOne('ds-1');
      expect(result.id).toBe('ds-1');
    });
  });

  // ===== update =====

  describe('update', () => {
    it('数据集不存在应抛 DATASET_NOT_FOUND', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      await expect(service.update('ds-x', { name: '新名' })).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NOT_FOUND,
      });
    });

    it('名称修改为已存在名称应抛 DATASET_NAME_EXISTS', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntity({ id: 'ds-1', name: '旧名', projectId: 'proj-1' }),
      );
      prisma.dataset.findFirst.mockResolvedValue(
        makeEntity({ id: 'ds-2', name: '已占名', projectId: 'proj-1' }),
      );

      await expect(service.update('ds-1', { name: '已占名' })).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NAME_EXISTS,
      });
      expect(prisma.dataset.update).not.toHaveBeenCalled();
    });

    it('名称未变化不应查重', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1', name: '同名' }));
      prisma.dataset.update.mockResolvedValue(makeEntity({ id: 'ds-1', name: '同名' }));

      await service.update('ds-1', { name: '同名' });

      expect(prisma.dataset.findFirst).not.toHaveBeenCalled();
    });

    it('更新后应失效该数据集的缓存', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));
      prisma.dataset.update.mockResolvedValue(makeEntity({ id: 'ds-1' }));

      await service.update('ds-1', { description: '新描述' });

      expect(cacheService.invalidateDataset).toHaveBeenCalledWith('ds-1');
    });

    it('config / shape / cache / mock 应序列化为 JSON', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));
      prisma.dataset.update.mockResolvedValue(makeEntity({ id: 'ds-1' }));

      await service.update('ds-1', {
        type: 'static',
        config: { staticData: { y: 2 } },
        shape: { dataPath: 'data.list' },
        cache: { enabled: true, ttl: 60 },
        mock: { enabled: false, generator: 'echo-params' },
        tags: ['a'],
      } as unknown as UpdateDatasetDto);

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ds-1' },
          data: expect.objectContaining({
            config: JSON.stringify({ staticData: { y: 2 } }),
            shape: JSON.stringify({ dataPath: 'data.list' }),
            cache: JSON.stringify({ enabled: true, ttl: 60 }),
            mock: JSON.stringify({ enabled: false, generator: 'echo-params' }),
            tags: JSON.stringify(['a']),
          }) as object,
        }) as object,
      );
    });

    it('tags 显式 undefined / 空数组应处理为 null / JSON', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));
      prisma.dataset.update.mockResolvedValue(makeEntity({ id: 'ds-1' }));

      // tags = []（空数组，truthy）应序列化为 '[]'
      await service.update('ds-1', { tags: [] });
      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: JSON.stringify([]),
          }) as object,
        }) as object,
      );
    });
  });

  // ===== remove =====

  describe('remove', () => {
    it('不存在应抛 DATASET_NOT_FOUND', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      await expect(service.remove('ds-x')).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NOT_FOUND,
      });
      expect(prisma.dataset.delete).not.toHaveBeenCalled();
    });

    it('does not use the legacy DatasetReference index when deleting', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));
      prisma.dataset.delete.mockResolvedValue(undefined);

      await service.remove('ds-1');

      expect(prisma.dataset.delete).toHaveBeenCalledWith({ where: { id: 'ds-1' } });
      expect(cacheService.invalidateDataset).toHaveBeenCalledWith('ds-1');
    });
  });

  // ===== getReferenceCount =====

  describe('getReferenceCount', () => {
    it('不存在应抛 DATASET_NOT_FOUND', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);
      await expect(service.getReferenceCount('ds-x')).rejects.toMatchObject({
        bizCode: BizCode.DATASET_NOT_FOUND,
      });
    });

    it('returns zero because canonical Screen documents do not maintain DatasetReference', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntity({ id: 'ds-1' }));

      const result = await service.getReferenceCount('ds-1');
      expect(result).toEqual({ datasetId: 'ds-1', count: 0 });
    });
  });

  describe('Screen host metric resources', () => {
    it('enforces Dataset.projectId before executing an opaque metric resource id', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({ id: 'dataset-1', projectId: 'other-project' }, 'published'),
      );

      await expect(
        service.executeMetricHostResource('project-1', 'dataset-1', false),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NOT_FOUND });
      expect(staticExecutor.execute).not.toHaveBeenCalled();
    });

    it('lists only active project datasets and returns parsed data for a published preview', async () => {
      prisma.dataset.findMany.mockResolvedValue([
        { id: 'dataset-1', name: 'CPU' },
        { id: 'dataset-2', name: 'Memory' },
      ]);
      await expect(service.listMetricHostResources('project-1')).resolves.toEqual([
        { resourceType: 'metric', resourceId: 'dataset-1', name: 'CPU' },
        { resourceType: 'metric', resourceId: 'dataset-2', name: 'Memory' },
      ]);
      expect(prisma.dataset.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', status: 'active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({ id: 'dataset-1', projectId: 'project-1' }, 'published'),
      );
      staticExecutor.execute.mockResolvedValue({ value: 42 });

      await expect(
        service.executeMetricHostResource('project-1', 'dataset-1', true),
      ).resolves.toEqual({ value: 42 });
    });
  });

  // ===== execute =====

  describe('execute - 匿名访问保护', () => {
    it('匿名访问未发布项目（非 mock）应抛 SCREEN_NOT_FOUND', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntityWithProject({}, 'draft'));

      await expect(
        service.execute('ds-1', { params: {}, useMock: false }, true),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NOT_FOUND });
    });

    it('匿名访问已发布项目应放行', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({ id: 'ds-1' }, 'published'),
      );
      staticExecutor.execute.mockResolvedValue({ data: 'ok' });

      await service.execute('ds-1', { params: {}, useMock: false }, true);

      expect(staticExecutor.execute).toHaveBeenCalled();
    });

    it('登录用户访问未发布项目应放行', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntityWithProject({ id: 'ds-1' }, 'draft'));
      staticExecutor.execute.mockResolvedValue({ data: 'ok' });

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(staticExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('execute - Mock 模式', () => {
    it('useMock=true 应覆盖 mock.enabled 并返回 mock 数据', async () => {
      // mock.enabled = false，但 useMock=true 应启用
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          mock: { enabled: false, generator: 'static', data: { mock: true } },
        }),
      );
      mockService.generate.mockReturnValue({ mock: true });

      const result = await service.execute('ds-1', { params: { x: 1 }, useMock: true }, false);

      expect(mockService.generate).toHaveBeenCalledWith(
        { enabled: false, generator: 'static', data: { mock: true } },
        { x: 1 },
      );
      expect(result.status).toBe('success');
      expect(result.raw).toEqual({ mock: true });
      expect(result.parsed).toEqual({ mock: true });
      expect(result.meta.fromCache).toBe(false);
      expect(staticExecutor.execute).not.toHaveBeenCalled();
    });

    it('mock.enabled=true 应自动启用 mock 模式', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          mock: { enabled: true, generator: 'echo-params' },
        }),
      );
      mockService.generate.mockReturnValue({ echoed: true });

      const result = await service.execute(
        'ds-1',
        { params: {}, useMock: false }, // useMock=false 但 mock.enabled=true
        false,
      );

      expect(mockService.generate).toHaveBeenCalled();
      expect(result.raw).toEqual({ echoed: true });
    });

    it('mock 模式应应用 filter', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          mock: { enabled: true, generator: 'static', data: { items: [1, 2, 3] } },
          shape: { filter: '$sum(items)' },
        }),
      );
      mockService.generate.mockReturnValue({ items: [1, 2, 3] });
      filterService.applyFilter.mockResolvedValue(6);

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(filterService.applyFilter).toHaveBeenCalledWith('$sum(items)', {
        items: [1, 2, 3],
      });
      expect(result.raw).toEqual({ items: [1, 2, 3] });
      expect(result.parsed).toBe(6);
    });

    it('mock 模式应应用 dataPath 提取', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          mock: { enabled: true, generator: 'static', data: { data: { list: ['a', 'b'] } } },
          shape: { dataPath: 'data.list' },
        }),
      );
      mockService.generate.mockReturnValue({ data: { list: ['a', 'b'] } });

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(result.parsed).toEqual(['a', 'b']);
    });

    it('匿名 + mock 模式访问未发布项目应放行', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject(
          { mock: { enabled: true, generator: 'static', data: { x: 1 } } },
          'draft',
        ),
      );
      mockService.generate.mockReturnValue({ x: 1 });

      const result = await service.execute(
        'ds-1',
        { params: {}, useMock: false },
        true, // 匿名
      );

      expect(result.status).toBe('success');
    });
  });

  describe('execute - 缓存', () => {
    it('缓存命中应直接返回（不调用执行器）', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          cache: { enabled: true, ttl: 60 },
        }),
      );
      cacheService.get.mockReturnValue({ cached: true });

      const result = await service.execute('ds-1', { params: { q: 'a' }, useMock: false }, false);

      expect(cacheService.get).toHaveBeenCalledWith('ds-1', { q: 'a' });
      expect(staticExecutor.execute).not.toHaveBeenCalled();
      expect(result.raw).toEqual({ cached: true });
      expect(result.parsed).toEqual({ cached: true });
      expect(result.meta.fromCache).toBe(true);
    });

    it('缓存未命中应执行并写入缓存', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          cache: { enabled: true, ttl: 60, tags: ['sales'] },
        }),
      );
      cacheService.get.mockReturnValue(undefined);
      staticExecutor.execute.mockResolvedValue({ fresh: true });

      await service.execute('ds-1', { params: { q: 'a' }, useMock: false }, false);

      expect(cacheService.set).toHaveBeenCalledWith(
        'ds-1',
        { q: 'a' },
        { fresh: true },
        { ttl: 60, tags: ['sales'] },
      );
    });

    it('未启用缓存不应读/写缓存', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntityWithProject({ cache: undefined }));
      staticExecutor.execute.mockResolvedValue({ data: 1 });

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('execute - 执行器分发', () => {
    it('type=static 应使用 StaticExecutor', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({ type: 'static', config: { staticData: { x: 1 } } }),
      );
      staticExecutor.execute.mockResolvedValue({ x: 1 });

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(staticExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'static', staticData: { x: 1 } }),
        {},
      );
    });

    it('type=api 应使用 ApiExecutor', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          type: 'api',
          config: { path: 'https://api.example.com', method: 'GET', contentType: 'json' },
        }),
      );
      apiExecutor.execute.mockResolvedValue({ ok: true });

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(apiExecutor.execute).toHaveBeenCalled();
    });

    it('type=sql 应使用 UnsupportedExecutor', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          type: 'sql',
          config: { connectionId: 'c1', sql: 'select 1' },
        }),
      );
      unsupportedExecutor.execute.mockResolvedValue({});

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(unsupportedExecutor.execute).toHaveBeenCalled();
    });

    it('type=websocket 应使用 UnsupportedExecutor', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          type: 'websocket',
          config: { url: 'wss://x', messageFormat: 'json' },
        }),
      );
      unsupportedExecutor.execute.mockResolvedValue({});

      await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(unsupportedExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('execute - filter + dataPath', () => {
    it('应依次应用 filter 与 dataPath（dataPath 作用于 filter 结果）', async () => {
      // raw = { data: { items: [{name:'a',value:20},{name:'b',value:5}] } }
      // filter = 'data.items[value>10]' → [{name:'a',value:20}]
      // dataPath = '' （filter 结果已是目标数组，无 dataPath 提取）
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          shape: { filter: 'data.items[value>10]' },
        }),
      );
      staticExecutor.execute.mockResolvedValue({
        data: {
          items: [
            { name: 'a', value: 20 },
            { name: 'b', value: 5 },
          ],
        },
      });
      filterService.applyFilter.mockResolvedValue([{ name: 'a', value: 20 }]);

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      // filter 接收原始 raw
      expect(filterService.applyFilter).toHaveBeenCalledWith('data.items[value>10]', {
        data: {
          items: [
            { name: 'a', value: 20 },
            { name: 'b', value: 5 },
          ],
        },
      });
      // 无 dataPath，parsed = filter 结果
      expect(result.parsed).toEqual([{ name: 'a', value: 20 }]);
    });

    it('filter 后通过 dataPath 提取嵌套字段', async () => {
      // raw = { wrapper: { items: [1,2,3] } }
      // filter = 'wrapper' → { items: [1,2,3] }
      // dataPath = 'items' → [1,2,3]
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          shape: { filter: 'wrapper', dataPath: 'items' },
        }),
      );
      staticExecutor.execute.mockResolvedValue({ wrapper: { items: [1, 2, 3] } });
      filterService.applyFilter.mockResolvedValue({ items: [1, 2, 3] });

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(result.parsed).toEqual([1, 2, 3]);
    });

    it('无 filter 无 dataPath 时 parsed = raw', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntityWithProject({}));
      staticExecutor.execute.mockResolvedValue({ raw: 'data' });

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(result.parsed).toEqual({ raw: 'data' });
      expect(filterService.applyFilter).not.toHaveBeenCalled();
    });

    it('dataPath 应支持嵌套路径提取', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          shape: { dataPath: 'a.b.c' },
        }),
      );
      staticExecutor.execute.mockResolvedValue({ a: { b: { c: 42 } } });

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(result.parsed).toBe(42);
    });

    it('dataPath 路径不存在应返回 undefined', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({ shape: { dataPath: 'a.b.c' } }),
      );
      staticExecutor.execute.mockResolvedValue({ a: { b: {} } });

      const result = await service.execute('ds-1', { params: {}, useMock: false }, false);

      expect(result.parsed).toBeUndefined();
    });
  });

  // ===== test =====

  describe('test', () => {
    it('mock 模式应使用 mockService.generate', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          mock: { enabled: true, generator: 'static', data: { mock: 1 } },
        }),
      );
      mockService.generate.mockReturnValue({ mock: 1 });

      const result = await service.test('ds-1', {
        params: {},
        useMock: false,
      });

      expect(mockService.generate).toHaveBeenCalled();
      expect(result.raw).toEqual({ mock: 1 });
      expect(result.meta.fromCache).toBe(false);
    });

    it('非 mock 模式应调用 executor.test', async () => {
      prisma.dataset.findUnique.mockResolvedValue(makeEntityWithProject({ type: 'static' }));
      staticExecutor.test.mockResolvedValue({
        raw: { x: 1 },
        parsed: { x: 1 },
        meta: { durationMs: 5 },
      });

      const result = await service.test('ds-1', {
        params: {},
        useMock: false,
      });

      expect(staticExecutor.test).toHaveBeenCalled();
      expect(result.raw).toEqual({ x: 1 });
      expect(result.meta.durationMs).toBe(5);
    });

    it('test 应支持 filter + dataPath（dataPath 作用于 filter 结果）', async () => {
      // raw = { wrapper: { items: [1,2,3] } }
      // filter = 'wrapper' → { items: [1,2,3] }
      // dataPath = 'items' → [1,2,3]
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntityWithProject({
          shape: { filter: 'wrapper', dataPath: 'items' },
        }),
      );
      staticExecutor.test.mockResolvedValue({
        raw: { wrapper: { items: [1, 2, 3] } },
        parsed: {},
        meta: { durationMs: 1 },
      });
      filterService.applyFilter.mockResolvedValue({ items: [1, 2, 3] });

      const result = await service.test('ds-1', {
        params: {},
        useMock: false,
      });

      expect(filterService.applyFilter).toHaveBeenCalledWith('wrapper', {
        wrapper: { items: [1, 2, 3] },
      });
      expect(result.parsed).toEqual([1, 2, 3]);
    });
  });

  // ===== toResponse（间接测试） =====

  describe('toResponse 序列化', () => {
    it('应将 JSON 字符串字段反序列化为对象', async () => {
      prisma.dataset.findUnique.mockResolvedValue(
        makeEntity({
          tags: ['a', 'b'],
          shape: { dataPath: 'data' },
          cache: { enabled: true, ttl: 30 },
          mock: { enabled: false, generator: 'echo-params' },
        }),
      );

      const result = await service.findOne('ds-1');

      expect(result.tags).toEqual(['a', 'b']);
      expect(result.shape).toEqual({ dataPath: 'data' });
      expect(result.cache).toEqual({ enabled: true, ttl: 30 });
      expect(result.mock).toEqual({ enabled: false, generator: 'echo-params' });
    });

    it('时间戳应格式化为 YYYY-MM-DD HH:mm:ss', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-01-02T00:00:00.000Z');
      prisma.dataset.findUnique.mockResolvedValue({
        ...makeEntity(),
        createdAt,
        updatedAt,
      });

      const result = await service.findOne('ds-1');

      expect(result.createdAt).toBe(dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss'));
      expect(result.updatedAt).toBe(dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss'));
    });
  });
});
