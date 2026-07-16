import { Test, type TestingModule } from '@nestjs/testing';
import { ScreenController } from '@/modules/screen/screen.controller';
import { ScreenService } from '@/modules/screen/screen.service';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
} from '@/modules/screen/dto/screen.dto';

interface MockScreenService {
  createProject: jest.Mock;
  findAllProjects: jest.Mock;
  findProjectById: jest.Mock;
  updateProject: jest.Mock;
  publishProject: jest.Mock;
  removeProject: jest.Mock;
}

const mockScreenService: MockScreenService = {
  createProject: jest.fn(),
  findAllProjects: jest.fn(),
  findProjectById: jest.fn(),
  updateProject: jest.fn(),
  publishProject: jest.fn(),
  removeProject: jest.fn(),
};

const defaultCanvas = {
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scaleMode: 'fit',
};

function makeResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'project-id',
    name: '测试大屏',
    description: null,
    canvas: defaultCanvas,
    components: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2025-07-16 10:00:00',
    updatedAt: '2025-07-16 10:00:00',
    ...overrides,
  };
}

describe('ScreenController', () => {
  let controller: ScreenController;
  let service: MockScreenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenController],
      providers: [{ provide: ScreenService, useValue: mockScreenService }],
    }).compile();

    controller = module.get<ScreenController>(ScreenController);
    service = module.get<MockScreenService>(ScreenService);
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should call service.createProject with dto', async () => {
      const dto: CreateScreenProjectDto = { name: '测试大屏' };
      const expected = makeResponse(dto);
      service.createProject.mockResolvedValue(expected);

      const result = await controller.createProject(dto);

      expect(service.createProject).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAllProjects', () => {
    it('should call service.findAllProjects', async () => {
      const expected = [makeResponse({ id: '1' }), makeResponse({ id: '2' })];
      service.findAllProjects.mockResolvedValue(expected);

      const result = await controller.findAllProjects();

      expect(service.findAllProjects).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('findProjectById', () => {
    it('should call service.findProjectById with id', async () => {
      const expected = makeResponse({ id: 'test-id' });
      service.findProjectById.mockResolvedValue(expected);

      const result = await controller.findProjectById('test-id');

      expect(service.findProjectById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(expected);
    });
  });

  describe('updateProject', () => {
    it('should call service.updateProject with id and dto', async () => {
      const dto: UpdateScreenProjectDto = { name: '更新后名称' };
      const expected = makeResponse({ id: 'test-id', name: '更新后名称' });
      service.updateProject.mockResolvedValue(expected);

      const result = await controller.updateProject('test-id', dto);

      expect(service.updateProject).toHaveBeenCalledWith('test-id', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('publishProject', () => {
    it('should call service.publishProject with id', async () => {
      const expected = makeResponse({ id: 'test-id', status: 'published' });
      service.publishProject.mockResolvedValue(expected);

      const result = await controller.publishProject('test-id');

      expect(service.publishProject).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(expected);
    });
  });

  describe('removeProject', () => {
    it('should call service.removeProject with id', async () => {
      service.removeProject.mockResolvedValue(undefined);

      await controller.removeProject('test-id');

      expect(service.removeProject).toHaveBeenCalledWith('test-id');
    });
  });

  describe('previewProject', () => {
    it('should call service.findProjectById for preview', async () => {
      const expected = makeResponse({ id: 'test-id', status: 'published' });
      service.findProjectById.mockResolvedValue(expected);

      const result = await controller.previewProject('test-id');

      expect(service.findProjectById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(expected);
    });
  });
});
