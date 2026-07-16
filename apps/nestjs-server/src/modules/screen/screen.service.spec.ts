import { Test, type TestingModule } from '@nestjs/testing';
import { ScreenService } from '@/modules/screen/screen.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
} from '@/modules/screen/dto/screen.dto';

interface ScreenProjectEntity {
  id: string;
  name: string;
  description: string | null;
  canvas: string;
  components: string;
  status: string;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mockPrismaService = {
  screenProject: {
    create: jest.fn<Promise<ScreenProjectEntity>, [unknown]>(),
    findMany: jest.fn<Promise<ScreenProjectEntity[]>, [unknown]>(),
    findUnique: jest.fn<Promise<ScreenProjectEntity | null>, [unknown]>(),
    findFirst: jest.fn<Promise<ScreenProjectEntity | null>, [unknown]>(),
    update: jest.fn<Promise<ScreenProjectEntity>, [unknown]>(),
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
      mockPrismaService.screenProject.create.mockResolvedValue(makeScreenProject(dto));

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

  describe('updateProject', () => {
    it('should update project name', async () => {
      const dto: UpdateScreenProjectDto = { name: '更新后名称' };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id' }),
      );
      mockPrismaService.screenProject.findFirst.mockResolvedValue(null);
      mockPrismaService.screenProject.update.mockResolvedValue(
        makeScreenProject({ id: 'test-id', name: '更新后名称' }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(result.name).toBe('更新后名称');
    });

    it('should update canvas and components', async () => {
      const newCanvas = { width: 2560, height: 1440, backgroundColor: '#222', scaleMode: 'fit' };
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
      };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id' }),
      );
      mockPrismaService.screenProject.update.mockResolvedValue(
        makeScreenProject({
          id: 'test-id',
          canvas: JSON.stringify(newCanvas),
          components: JSON.stringify(newComponents),
        }),
      );

      const result = await service.updateProject('test-id', dto);

      expect(mockPrismaService.screenProject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-id' },
          data: expect.objectContaining({
            canvas: JSON.stringify(newCanvas),
            components: JSON.stringify(newComponents),
          }) as object,
        }) as object,
      );
      expect(result.canvas.width).toBe(2560);
      expect(result.components).toHaveLength(1);
    });

    it('should throw BusinessException when updating to duplicate name', async () => {
      const dto: UpdateScreenProjectDto = { name: '重复名称' };
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id' }),
      );
      mockPrismaService.screenProject.findFirst.mockResolvedValue(
        makeScreenProject({ id: 'other-id', name: '重复名称' }),
      );

      await expect(service.updateProject('test-id', dto)).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException when project not found', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      await expect(service.updateProject('non-existent', { name: 'x' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('publishProject', () => {
    it('should set status to published', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(
        makeScreenProject({ id: 'test-id', status: 'draft' }),
      );
      mockPrismaService.screenProject.update.mockResolvedValue(
        makeScreenProject({ id: 'test-id', status: 'published' }),
      );

      const result = await service.publishProject('test-id');

      expect(result.status).toBe('published');
      expect(mockPrismaService.screenProject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-id' },
          data: { status: 'published' },
        }) as object,
      );
    });

    it('should throw BusinessException when project not found', async () => {
      mockPrismaService.screenProject.findUnique.mockResolvedValue(null);

      await expect(service.publishProject('non-existent')).rejects.toThrow(BusinessException);
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
});
