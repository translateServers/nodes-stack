import { Test, type TestingModule } from '@nestjs/testing';
import { DatasetReferenceService } from '@/modules/dataset/dataset-reference.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { ScreenComponent } from '@nebula/shared/schemas';

describe('DatasetReferenceService', () => {
  let service: DatasetReferenceService;
  let prisma: {
    datasetReference: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      datasetReference: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      // $transaction 回调形式：将 tx 代理到 prisma 本身（共享 datasetReference mock）
      $transaction: jest.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatasetReferenceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DatasetReferenceService);
  });

  function makeComponent(id: string, datasetId?: string): ScreenComponent {
    const base = {
      id,
      type: 'bar-chart',
      name: `Component ${id}`,
      props: {},
      position: { x: 0, y: 0, width: 400, height: 300 },
    } as unknown as ScreenComponent;
    if (datasetId) {
      (base as unknown as { dataSource: unknown }).dataSource = {
        type: 'dataset',
        datasetId,
      };
    }
    return base;
  }

  describe('rebuildReferences', () => {
    it('应从 components 提取 dataset 引用并重建索引', async () => {
      const components = [
        makeComponent('c1', 'ds-1'),
        makeComponent('c2', 'ds-2'),
        makeComponent('c3'), // 无 dataset 数据源
        makeComponent('c4', 'ds-1'), // 重复引用同一数据集（不同组件）
      ];

      await service.rebuildReferences('project-1', components);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.datasetReference.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
      expect(prisma.datasetReference.createMany).toHaveBeenCalledWith({
        data: [
          { datasetId: 'ds-1', projectId: 'project-1', componentId: 'c1' },
          { datasetId: 'ds-2', projectId: 'project-1', componentId: 'c2' },
          { datasetId: 'ds-1', projectId: 'project-1', componentId: 'c4' },
        ],
      });
    });

    it('无 dataset 引用时应只删除不插入', async () => {
      const components = [
        makeComponent('c1'), // 无数据源
        makeComponent('c2'), // static 数据源
      ];

      await service.rebuildReferences('project-1', components);

      expect(prisma.datasetReference.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
      expect(prisma.datasetReference.createMany).not.toHaveBeenCalled();
    });

    it('空 components 应只删除不插入', async () => {
      await service.rebuildReferences('project-1', []);
      expect(prisma.datasetReference.deleteMany).toHaveBeenCalled();
      expect(prisma.datasetReference.createMany).not.toHaveBeenCalled();
    });
  });

  describe('countReferences', () => {
    it('应返回引用数', async () => {
      prisma.datasetReference.count.mockResolvedValueOnce(3);
      const count = await service.countReferences('ds-1');
      expect(count).toBe(3);
      expect(prisma.datasetReference.count).toHaveBeenCalledWith({
        where: { datasetId: 'ds-1' },
      });
    });

    it('无引用应返回 0', async () => {
      prisma.datasetReference.count.mockResolvedValueOnce(0);
      const count = await service.countReferences('ds-1');
      expect(count).toBe(0);
    });
  });

  describe('countReferencesBatch', () => {
    it('应批量返回引用数', async () => {
      prisma.datasetReference.groupBy.mockResolvedValueOnce([
        { datasetId: 'ds-1', _count: { datasetId: 3 } },
        { datasetId: 'ds-2', _count: { datasetId: 1 } },
      ]);

      const result = await service.countReferencesBatch(['ds-1', 'ds-2', 'ds-3']);
      expect(result.get('ds-1')).toBe(3);
      expect(result.get('ds-2')).toBe(1);
      expect(result.get('ds-3')).toBe(0); // 未在 groupBy 结果中，默认 0
    });

    it('空列表应返回空 Map', async () => {
      const result = await service.countReferencesBatch([]);
      expect(result.size).toBe(0);
      expect(prisma.datasetReference.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('checkReferencesBeforeDelete', () => {
    it('存在引用应抛出异常', async () => {
      prisma.datasetReference.count.mockResolvedValueOnce(2);
      await expect(service.checkReferencesBeforeDelete('ds-1')).rejects.toThrow(BusinessException);
    });

    it('无引用不应抛出异常', async () => {
      prisma.datasetReference.count.mockResolvedValueOnce(0);
      await expect(service.checkReferencesBeforeDelete('ds-1')).resolves.toBeUndefined();
    });
  });
});
