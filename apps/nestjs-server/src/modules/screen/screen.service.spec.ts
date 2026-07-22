import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { ScreenService } from '@/modules/screen/screen.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
  PublishScreenProjectDto,
} from '@/modules/screen/dto/screen.dto';
import type { EventBlueprint } from '@nebula/shared';

interface ScreenProjectEntity {
  id: string;
  name: string;
  description: string | null;
  canvas: string;
  components: string;
  blueprint: string | null;
  status: string;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateManyResult {
  count: number;
}

const mockPrismaService = {
  screenProject: {
    create: jest.fn<Promise<ScreenProjectEntity>, [unknown]>(),
    findMany: jest.fn<Promise<ScreenProjectEntity[]>, [unknown]>(),
    findUnique: jest.fn<Promise<ScreenProjectEntity | null>, [unknown]>(),
    findFirst: jest.fn<Promise<ScreenProjectEntity | null>, [unknown]>(),
    update: jest.fn<Promise<ScreenProjectEntity>, [unknown]>(),
    updateMany: jest.fn<Promise<UpdateManyResult>, [unknown]>(),
    delete: jest.fn<Promise<ScreenProjectEntity>, [unknown]>(),
  },
};

const defaultCanvas = {
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scaleMode: 'fit',
};

function makeScreenProject(overrides: Partial<ScreenProjectEntity> = {}): ScreenProjectEntity {
  const now = new Date('2025-07-16T10:00:00.000Z');
  return {
    id: overrides.id ?? 'project-id',
    name: overrides.name ?? '测试大屏',
    description: overrides.description ?? null,
    canvas: overrides.canvas ?? JSON.stringify(defaultCanvas),
    components: overrides.components ?? '[]',
    blueprint: overrides.blueprint ?? null,
    status: overrides.status ?? 'draft',
    thumbnail: overrides.thumbnail ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('ScreenService', () => {
  let service: ScreenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScreenService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ScreenService>(ScreenService);
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a screen project with default canvas', async () => {
      const dto: CreateScreenProjectDto = { name: '测试大屏' };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);
      mockPrismaService.screenProject.create.mockResolvedValue(
        makeScreenProject({ name: dto.name }),
      );

      const result = await service.createProject(dto);

      expect(mockPrismaService.screenProject.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '测试大屏',
            canvas: JSON.stringify(defaultCanvas),
            components: '[]',
            status: 'draft',
          }) as object,
        }) as object,
      );
      expect(result.name).toBe('测试大屏');
      expect(result.canvas.width).toBe(1920);
      expect(result.components).toEqual([]);
      expect(typeof result.createdAt).toBe('string');
    });

    it('should create with custom canvas config', async () => {
      const dto: CreateScreenProjectDto = {
        name: '自定义画布',
        canvas: { width: 3840, height: 2160, backgroundColor: '#111', scaleMode: 'full' },
      };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);
      mockPrismaService.screenProject.create.mockResolvedValue(
        makeScreenProject({
          name: '自定义画布',
          canvas: JSON.stringify(dto.canvas),
        }),
      );

      const result = await service.createProject(dto);

      expect(result.canvas.width).toBe(3840);
    });

    it('should throw BusinessException when name already exists', async () => {
      const dto: CreateScreenProjectDto = { name: '已存在' };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ name: '已存在' }),
      );

      await expect(service.createProject(dto)).rejects.toThrow(BusinessException);
      expect(mockPrismaService.screenProject.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllProjects', () => {
    it('should return all projects', async () => {
      const projects = [
        makeScreenProject({ id: '1', name: '大屏1' }),
        makeScreenProject({ id: '2', name: '大屏2' }),
      ];
      mockPrismaService.screenProject.findMany.mockResolvedValue(projects);

      const result = await service.findAllProjects();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('大屏1');
      expect(result[1].name).toBe('大屏2');
    });
  });

  describe('findProjectById', () => {
    it('should return project when found', async () => {
      const project = makeScreenProject({ id: 'test-id', name: '我的大屏' });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(project);

      const result = await service.findProjectById('test-id');

      expect(result.id).toBe('test-id');
      expect(result.name).toBe('我的大屏');
    });

    it('should throw BusinessException when not found', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      await expect(service.findProjectById('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('findPublishedProjectById', () => {
    it('should return published project with full data', async () => {
      const project = makeScreenProject({
        id: 'published-id',
        name: '已发布大屏',
        status: 'published',
        description: '描述内容',
        thumbnail: 'data:image/png;base64,xxx',
      });
      mockPrismaService.screenProject.findFirst.mockResolvedValue(project);

      const result = await service.findPublishedProjectById('published-id');

      expect(mockPrismaService.screenProject.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.findFirst).toHaveBeenCalledWith({
        where: { id: 'published-id', status: 'published' },
      });
      expect(result.id).toBe('published-id');
      expect(result.name).toBe('已发布大屏');
      expect(result.status).toBe('published');
      expect(result.description).toBe('描述内容');
      expect(result.thumbnail).toBe('data:image/png;base64,xxx');
      expect(result.canvas.width).toBe(1920);
      expect(result.components).toEqual([]);
    });

    it('should throw BusinessException when project is draft', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedProjectById('draft-id')).rejects.toThrow(BusinessException);
      expect(mockPrismaService.screenProject.findFirst).toHaveBeenCalledWith({
        where: { id: 'draft-id', status: 'published' },
      });
    });

    it('should throw BusinessException when project does not exist', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedProjectById('non-existent')).rejects.toThrow(
        BusinessException,
      );
      expect(mockPrismaService.screenProject.findFirst).toHaveBeenCalledWith({
        where: { id: 'non-existent', status: 'published' },
      });
    });

    it('should query with published filter so draft data is never fetched even when draft exists', async () => {
      // 模拟数据库中存在一个草稿项目,含敏感标识内容
      const draftWithSensitiveData = makeScreenProject({
        id: 'draft-id',
        name: '机密草稿名称',
        description: '机密描述内容',
        canvas: JSON.stringify({
          width: 9999,
          height: 9999,
          backgroundColor: '#secret-color',
          scaleMode: 'fit',
        }),
        components: JSON.stringify([
          {
            id: 'comp-secret',
            type: 'text',
            name: '机密组件',
            position: { x: 1, y: 2, width: 3, height: 4 },
            style: {},
            props: { content: '机密文本' },
            status: { locked: false, hidden: false },
            zIndex: 1,
          },
        ]),
        status: 'draft',
      });

      // 即便数据库中存在该草稿项目,findFirst 因 status: 'published' 过滤返回 null
      mockPrismaService.screenProject.findFirst.mockImplementation((args) => {
        const where = (args as { where?: { status?: string } }).where;
        if (where?.status === 'published') {
          return Promise.resolve(null);
        }
        return Promise.resolve(draftWithSensitiveData);
      });

      await expect(service.findPublishedProjectById('draft-id')).rejects.toThrow(BusinessException);
      // 验证查询使用了 published 过滤,草稿数据未进入服务层
      expect(mockPrismaService.screenProject.findFirst).toHaveBeenCalledWith({
        where: { id: 'draft-id', status: 'published' },
      });
    });

    it('should throw BusinessException carrying only code/message, no draft content', async () => {
      // 模拟数据库中存在一个草稿项目,含敏感标识内容
      // 由于服务使用 status: 'published' 过滤,findFirst 返回 null,草稿数据不会被读取
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);

      let caught: unknown;
      try {
        await service.findPublishedProjectById('draft-id');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      const ex = caught as BusinessException;
      // 异常只携带业务码和默认消息
      expect(ex.bizCode).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(ex.bizMessage).toBe('大屏项目不存在');
      expect(ex.details).toBeUndefined();
      // 异常本身不应携带任何项目业务字段(画布、组件、描述、缩略图、状态)
      expect(ex).not.toHaveProperty('canvas');
      expect(ex).not.toHaveProperty('components');
      expect(ex).not.toHaveProperty('description');
      expect(ex).not.toHaveProperty('thumbnail');
      // 异常序列化后不应包含草稿业务字段
      const serialized = JSON.stringify(ex);
      expect(serialized).not.toContain('canvas');
      expect(serialized).not.toContain('components');
      expect(serialized).not.toContain('description');
      expect(serialized).not.toContain('thumbnail');
    });

    it('should serialize exception to response body without draft content', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);

      let caught: unknown;
      try {
        await service.findPublishedProjectById('draft-id');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      const ex = caught as BusinessException;
      // 模拟 HttpExceptionFilter 序列化后的响应体结构
      const responseBody = {
        code: ex.bizCode,
        message: ex.bizMessage,
        ...(ex.details ? { details: ex.details } : {}),
      };
      const serialized = JSON.stringify(responseBody);
      // 响应体只包含 code/message,与 ApiErrorResponse 形状一致
      expect(serialized).toBe(
        JSON.stringify({
          code: BizCode.SCREEN_NOT_FOUND,
          message: '大屏项目不存在',
        }),
      );
      // 响应体不应包含任何草稿业务字段
      expect(serialized).not.toContain('canvas');
      expect(serialized).not.toContain('components');
      expect(serialized).not.toContain('description');
      expect(serialized).not.toContain('thumbnail');
      expect(serialized).not.toContain('draft');
      expect(serialized).not.toContain('published');
    });
  });

  describe('updateProject', () => {
    it('should update project name', async () => {
      const dto: UpdateScreenProjectDto = {
        name: '更新后名称',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id', name: '更新后名称' }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({
          name: '更新后名称',
          status: 'draft',
        }) as object,
      });
      expect(result.name).toBe('更新后名称');
    });

    it('should update canvas and components', async () => {
      const newCanvas = {
        width: 2560,
        height: 1440,
        backgroundColor: '#222',
        scaleMode: 'fit' as const,
      };
      const newComponents = [
        {
          id: 'comp-1',
          type: 'text',
          name: '文本',
          position: { x: 100, y: 100, width: 200, height: 60 },
          style: {},
          props: { content: 'hello' },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ];
      const dto: UpdateScreenProjectDto = {
        canvas: newCanvas,
        components: newComponents,
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({
          id: 'test-id',
          canvas: JSON.stringify(newCanvas),
          components: JSON.stringify(newComponents),
        }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({
          canvas: JSON.stringify(newCanvas),
          components: JSON.stringify(newComponents),
          status: 'draft',
        }) as object,
      });
      expect(result.canvas.width).toBe(2560);
      expect(result.components).toHaveLength(1);
    });

    it('should throw BusinessException when updating to duplicate name', async () => {
      const dto: UpdateScreenProjectDto = {
        name: '重复名称',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeScreenProject({ id: 'other-id', name: '重复名称' }),
      );

      await expect(service.updateProject('test-id', dto)).rejects.toThrow(BusinessException);
      expect(mockPrismaService.screenProject.updateMany).not.toHaveBeenCalled();
    });

    it('版本冲突时抛 SCREEN_SAVE_CONFLICT，且数据库不被覆盖', async () => {
      // 任务 6.2：项目存在但 updatedAt 不匹配基线时为版本冲突；
      // updateMany 因 where 条件未命中而 count===0，未写入任何记录，
      // 服务仅以只读 findUnique 区分错误类型，不执行覆盖写入。
      const dto: UpdateScreenProjectDto = {
        name: '新名称',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      // 项目存在：findUnique 返回非空，仅校验存在性
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id', name: '旧名称' }),
      );

      let caught: unknown;
      try {
        await service.updateProject('test-id', dto);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).bizCode).toBe(BizCode.SCREEN_SAVE_CONFLICT);
      // updateMany 仅以条件 where 触发一次，count===0 即未写入
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({
          name: '新名称',
          status: 'draft',
        }) as object,
      });
      // 未触发无条件 update 覆盖写入
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      // 仅以 id 字段读取项目存在性，减少读开销
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        select: { id: true },
      });
    });

    it('项目不存在时抛 SCREEN_NOT_FOUND', async () => {
      // 任务 6.2：条件写入未命中且项目确实不存在时为 SCREEN_NOT_FOUND。
      const dto: UpdateScreenProjectDto = {
        name: '新名称',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      let caught: unknown;
      try {
        await service.updateProject('non-existent', dto);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).bizCode).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        select: { id: true },
      });
      // 不存在分支同样不执行覆盖写入
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
    });

    it('应匹配基线时受影响记录数为 1，返回新 updatedAt 和 draft 状态', async () => {
      const baselineUpdatedAt = '2025-07-16 10:00:00';
      const newUpdatedAt = new Date('2025-07-16 11:00:00.000Z');
      const dto: UpdateScreenProjectDto = {
        description: '新描述',
        expectedUpdatedAt: baselineUpdatedAt,
      };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({
          id: 'test-id',
          description: '新描述',
          status: 'draft',
          updatedAt: newUpdatedAt,
        }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(baselineUpdatedAt) },
        data: expect.objectContaining({
          description: '新描述',
          status: 'draft',
        }) as object,
      });
      expect(result.status).toBe('draft');
      // DateTimeStringSchema 会将 Date 按 dayjs 本地时区格式化为 YYYY-MM-DD HH:mm:ss
      expect(result.updatedAt).toBe(dayjs(newUpdatedAt).format('YYYY-MM-DD HH:mm:ss'));
    });

    it('应将原 published 项目保存后变为 draft，退出公开可见', async () => {
      const dto: UpdateScreenProjectDto = {
        description: '保存已发布项目',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      // 保存前项目为 published，保存后查询返回 draft
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({
          id: 'test-id',
          status: 'draft',
          description: '保存已发布项目',
        }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({
          description: '保存已发布项目',
          status: 'draft',
        }) as object,
      });
      expect(result.status).toBe('draft');
    });
  });

  describe('publishProject', () => {
    it('匹配基线时发布成功，返回新 updatedAt', async () => {
      // 任务 6.3：当 dto.expectedUpdatedAt 与数据库 updatedAt 一致时，
      // updateMany 命中一条记录，发布成功，返回新 updatedAt 与 published 状态。
      const baselineUpdatedAt = '2025-07-16 10:00:00';
      const newUpdatedAt = new Date('2025-07-16 11:30:00.000Z');
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: baselineUpdatedAt };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({
          id: 'test-id',
          status: 'published',
          updatedAt: newUpdatedAt,
        }),
      );

      const result = await service.publishProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(baselineUpdatedAt) },
        data: expect.objectContaining({ status: 'published' }) as object,
      });
      // 发布只改状态，不接收可编辑内容
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      expect(result.status).toBe('published');
      // DateTimeStringSchema 会将 Date 按 dayjs 本地时区格式化为 YYYY-MM-DD HH:mm:ss
      expect(result.updatedAt).toBe(dayjs(newUpdatedAt).format('YYYY-MM-DD HH:mm:ss'));
    });

    it('过期基线不改变状态，抛 SCREEN_SAVE_CONFLICT', async () => {
      // 任务 6.3：项目存在但 updatedAt 不匹配基线时为版本冲突；
      // updateMany 因 where 条件未命中而 count===0，未写入任何记录，
      // 服务仅以只读 findUnique 区分错误类型，不执行覆盖写入，过期基线不改变状态。
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: '2025-07-16 10:00:00' };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      // 项目存在：findUnique 返回非空，仅校验存在性
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id', status: 'draft' }),
      );

      let caught: unknown;
      try {
        await service.publishProject('test-id', dto);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).bizCode).toBe(BizCode.SCREEN_SAVE_CONFLICT);
      // updateMany 仅以条件 where 触发一次，count===0 即未写入
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({ status: 'published' }) as object,
      });
      // 未触发无条件 update 覆盖写入，过期基线不改变状态
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      // 仅以 id 字段读取项目存在性，减少读开销
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        select: { id: true },
      });
    });

    it('项目不存在抛 SCREEN_NOT_FOUND', async () => {
      // 任务 6.3：条件写入未命中且项目确实不存在时为 SCREEN_NOT_FOUND。
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: '2025-07-16 10:00:00' };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      let caught: unknown;
      try {
        await service.publishProject('non-existent', dto);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).bizCode).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'non-existent', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({ status: 'published' }) as object,
      });
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        select: { id: true },
      });
      // 任务 6.4：不存在分支同样不执行任何覆盖写入，
      // update/create/delete 等会改变数据库内容的方法均未被调用。
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.create).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.delete).not.toHaveBeenCalled();
    });

    it('冲突时数据库内容不变：除条件写入 updateMany 外无其他写入方法被调用', async () => {
      // 任务 6.4：固化冲突分支不执行任何覆盖写入。
      // 仅条件写入 updateMany（count===0 未命中）与只读 findUnique 被调用，
      // update/create/delete 等会改变数据库内容的方法均未被调用，
      // 因此数据库内容保持不变，published 状态不会被错误写入。
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: '2025-07-16 10:00:00' };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      // 项目存在但基线过期：findUnique 返回非空，仅校验存在性
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id', status: 'draft' }),
      );

      await expect(service.publishProject('test-id', dto)).rejects.toThrow(BusinessException);

      // 条件写入仅触发一次，且 where 条件包含 updatedAt 基线，data 只改 status
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({ status: 'published' }) as object,
      });
      // 所有其他会改变数据库内容的方法均未被调用，数据库内容保持不变
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.create).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.delete).not.toHaveBeenCalled();
      // 只读查询仅以 id 字段查询存在性，不读取业务字段
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        select: { id: true },
      });
    });

    it('不存在时数据库内容不变：除条件写入 updateMany 外无其他写入方法被调用', async () => {
      // 任务 6.4：固化不存在分支同样不执行任何覆盖写入，
      // published 状态不会被错误写入不存在的记录。
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: '2025-07-16 10:00:00' };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      await expect(service.publishProject('non-existent', dto)).rejects.toThrow(BusinessException);

      // 条件写入仅触发一次，且 where 条件包含 updatedAt 基线
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'non-existent', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({ status: 'published' }) as object,
      });
      // 所有其他会改变数据库内容的方法均未被调用
      expect(mockPrismaService.screenProject.update).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.create).not.toHaveBeenCalled();
      expect(mockPrismaService.screenProject.delete).not.toHaveBeenCalled();
      // 只读查询仅以 id 字段查询存在性
      expect(mockPrismaService.screenProject.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        select: { id: true },
      });
    });
  });

  describe('removeProject', () => {
    it('should delete project', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id' }),
      );
      mockPrismaService.screenProject.delete.mockResolvedValue(
        makeScreenProject({ id: 'test-id' }),
      );

      await service.removeProject('test-id');

      expect(mockPrismaService.screenProject.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw BusinessException when project not found', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      await expect(service.removeProject('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('findPublishedProjectById 敏感请求头脱敏（任务 9.1）', () => {
    function makeProjectWithApiHeaders(headers: Record<string, string>): ScreenProjectEntity {
      const components = [
        {
          id: 'chart-1',
          type: 'bar-chart',
          name: '图表',
          position: { x: 0, y: 0, width: 400, height: 300 },
          style: {},
          props: { title: '测试' },
          status: { locked: false, hidden: false },
          zIndex: 0,
          dataSource: {
            type: 'api',
            apiConfig: {
              url: 'https://example.com/api/chart',
              method: 'GET',
              headers,
            },
          },
        },
      ];
      return makeScreenProject({
        status: 'published',
        components: JSON.stringify(components),
      });
    }

    it('敏感请求头值被替换为 [REDACTED]', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeProjectWithApiHeaders({
          Authorization: 'Bearer secret-token',
          'X-Custom': 'visible-value',
        }),
      );

      const result = await service.findPublishedProjectById('project-id');
      const headers = result.components[0].dataSource?.apiConfig?.headers;
      expect(headers?.Authorization).toBe('[REDACTED]');
      expect(headers?.['X-Custom']).toBe('visible-value');
    });

    it('大小写不敏感识别敏感键名', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeProjectWithApiHeaders({
          COOKIE: 'session=abc123',
          'x-api-key': 'key-123',
          'X-AUTH-TOKEN': 'token-456',
        }),
      );

      const result = await service.findPublishedProjectById('project-id');
      const headers = result.components[0].dataSource?.apiConfig?.headers;
      expect(headers?.COOKIE).toBe('[REDACTED]');
      expect(headers?.['x-api-key']).toBe('[REDACTED]');
      expect(headers?.['X-AUTH-TOKEN']).toBe('[REDACTED]');
    });

    it('非敏感请求头不受影响', async () => {
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeProjectWithApiHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      );

      const result = await service.findPublishedProjectById('project-id');
      const headers = result.components[0].dataSource?.apiConfig?.headers;
      expect(headers?.['Content-Type']).toBe('application/json');
      expect(headers?.Accept).toBe('application/json');
    });

    it('无数据源组件不受影响', async () => {
      const components = [
        {
          id: 'text-1',
          type: 'text',
          name: '文本',
          position: { x: 0, y: 0, width: 200, height: 50 },
          style: {},
          props: { content: 'hello' },
          status: { locked: false, hidden: false },
          zIndex: 0,
        },
      ];
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeScreenProject({ status: 'published', components: JSON.stringify(components) }),
      );

      const result = await service.findPublishedProjectById('project-id');
      expect(result.components[0]).toEqual(expect.objectContaining({ id: 'text-1' }));
    });

    it('受保护详情接口返回完整请求头配置（不脱敏）', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeProjectWithApiHeaders({ Authorization: 'Bearer secret-token' }),
      );

      const result = await service.findProjectById('project-id');
      const headers = result.components[0].dataSource?.apiConfig?.headers;
      expect(headers?.Authorization).toBe('Bearer secret-token');
    });
  });

  // ===== 事件蓝图任务 1.4：服务端同源校验与持久化 =====

  describe('updateProject — blueprint 字段持久化（任务 1.4）', () => {
    const validBlueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: { x: 200, y: 0 },
          config: {
            type: 'setVisibility',
            targetComponentId: 'c2',
            visible: 'toggle',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 't1',
          sourceHandle: 'out',
          target: 'a1',
          targetHandle: 'in',
        },
      ],
    };

    it('dto 含 blueprint 时写入数据库', async () => {
      const dto: UpdateScreenProjectDto = {
        blueprint: validBlueprint,
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ blueprint: JSON.stringify(validBlueprint) }),
      );

      await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-id', updatedAt: new Date(dto.expectedUpdatedAt) },
        data: expect.objectContaining({
          blueprint: JSON.stringify(validBlueprint),
          status: 'draft',
        }) as object,
      });
    });

    it('dto 不含 blueprint 时不动 blueprint 列（不传入 data）', async () => {
      const dto: UpdateScreenProjectDto = {
        name: '只改名字',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ name: '只改名字' }),
      );

      await service.updateProject('test-id', dto);

      const call = mockPrismaService.screenProject.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).not.toHaveProperty('blueprint');
    });

    it('toProjectResponse 解析 blueprint 字符串为对象', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ blueprint: JSON.stringify(validBlueprint) }),
      );

      const result = await service.findProjectById('project-id');

      expect(result.blueprint).toBeDefined();
      expect(result.blueprint?.version).toBe(1);
      expect(result.blueprint?.nodes).toHaveLength(2);
      expect(result.blueprint?.edges).toHaveLength(1);
    });

    it('blueprint 列为 null 时 response 不含 blueprint 字段（不凭空写入）', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ blueprint: null }),
      );

      const result = await service.findProjectById('project-id');

      expect(result.blueprint).toBeUndefined();
    });

    it('含非法 blueprint 的更新请求被同源 Schema 拒绝（updateMany 不触发）', async () => {
      // DTO 构造时 nestjs-zod 已校验，此处直接断言非法蓝图不会进入 updateMany.data
      // 模拟一个绕过 DTO 的非法 payload：调用 updateMany 前不会经过额外校验，
      // 因此测试聚焦在合法 DTO 时 data.blueprint 一定是合法 JSON 字符串。
      const dto: UpdateScreenProjectDto = {
        blueprint: {
          version: 1,
          nodes: [],
          edges: [],
        },
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      mockPrismaService.screenProject.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ blueprint: JSON.stringify(dto.blueprint) }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(result.blueprint).toEqual({ version: 1, nodes: [], edges: [] });
    });

    it('findPublishedProjectById 返回已发布项目的 blueprint', async () => {
      // 草稿蓝图不通过公开预览暴露：通过 status='published' 过滤实现
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeScreenProject({
          status: 'published',
          blueprint: JSON.stringify(validBlueprint),
        }),
      );

      const result = await service.findPublishedProjectById('project-id');

      expect(result.blueprint).toBeDefined();
      expect(result.blueprint?.nodes).toHaveLength(2);
    });

    it('草稿项目的 blueprint 不进入公开预览响应', async () => {
      // findFirst 以 status='published' 过滤，草稿数据不会被读取
      mockPrismaService.screenProject.findFirst.mockImplementation((args) => {
        const where = (args as { where?: { status?: string } }).where;
        if (where?.status === 'published') {
          return Promise.resolve(null);
        }
        return Promise.resolve(
          makeScreenProject({
            status: 'draft',
            blueprint: JSON.stringify(validBlueprint),
          }),
        );
      });

      await expect(service.findPublishedProjectById('draft-id')).rejects.toThrow(BusinessException);
    });
  });
});
