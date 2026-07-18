import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ScreenController } from '@/modules/screen/screen.controller';
import { ScreenService } from '@/modules/screen/screen.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
  PublishScreenProjectDto,
} from '@/modules/screen/dto/screen.dto';

interface MockScreenService {
  createProject: jest.Mock<Promise<Record<string, unknown>>, [CreateScreenProjectDto]>;
  findAllProjects: jest.Mock<Promise<Record<string, unknown>[]>, []>;
  findProjectById: jest.Mock<Promise<Record<string, unknown>>, [string]>;
  findPublishedProjectById: jest.Mock<Promise<Record<string, unknown>>, [string]>;
  updateProject: jest.Mock<Promise<Record<string, unknown>>, [string, UpdateScreenProjectDto]>;
  publishProject: jest.Mock<Promise<Record<string, unknown>>, [string, PublishScreenProjectDto]>;
  removeProject: jest.Mock<Promise<void>, [string]>;
}

const mockScreenService: MockScreenService = {
  createProject: jest.fn<Promise<Record<string, unknown>>, [CreateScreenProjectDto]>(),
  findAllProjects: jest.fn<Promise<Record<string, unknown>[]>, []>(),
  findProjectById: jest.fn<Promise<Record<string, unknown>>, [string]>(),
  findPublishedProjectById: jest.fn<Promise<Record<string, unknown>>, [string]>(),
  updateProject: jest.fn<Promise<Record<string, unknown>>, [string, UpdateScreenProjectDto]>(),
  publishProject: jest.fn<Promise<Record<string, unknown>>, [string, PublishScreenProjectDto]>(),
  removeProject: jest.fn<Promise<void>, [string]>(),
};

const defaultCanvas = {
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scaleMode: 'fit',
};

function makeResponse(overrides: object = {}): Record<string, unknown> {
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
    ...(overrides as Record<string, unknown>),
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
      const dto: UpdateScreenProjectDto = {
        name: '更新后名称',
        expectedUpdatedAt: '2025-07-16 10:00:00',
      };
      const expected = makeResponse({ id: 'test-id', name: '更新后名称' });
      service.updateProject.mockResolvedValue(expected);

      const result = await controller.updateProject('test-id', dto);

      // DTO 原样传给服务层,基线 expectedUpdatedAt 不被控制器剥离
      expect(service.updateProject).toHaveBeenCalledTimes(1);
      expect(service.updateProject).toHaveBeenCalledWith('test-id', dto);
      const receivedDto = service.updateProject.mock.calls[0]?.[1];
      expect(receivedDto).toEqual(dto);
      expect(receivedDto).toHaveProperty('expectedUpdatedAt', '2025-07-16 10:00:00');
      expect(result).toEqual(expected);
    });
  });

  describe('publishProject', () => {
    it('should call service.publishProject with id and dto', async () => {
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: '2025-07-16 10:00:00' };
      const expected = makeResponse({ id: 'test-id', status: 'published' });
      service.publishProject.mockResolvedValue(expected);

      const result = await controller.publishProject('test-id', dto);

      // 旧的无请求体发布断言被替换为带基线断言:DTO 原样传给服务层
      expect(service.publishProject).toHaveBeenCalledTimes(1);
      expect(service.publishProject).toHaveBeenCalledWith('test-id', dto);
      const receivedDto = service.publishProject.mock.calls[0]?.[1];
      expect(receivedDto).toEqual(dto);
      expect(receivedDto).toHaveProperty('expectedUpdatedAt', '2025-07-16 10:00:00');
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
    it('should call service.findPublishedProjectById for preview', async () => {
      const expected = makeResponse({ id: 'test-id', status: 'published' });
      service.findPublishedProjectById.mockResolvedValue(expected);

      const result = await controller.previewProject('test-id');

      expect(service.findPublishedProjectById).toHaveBeenCalledWith('test-id');
      expect(service.findProjectById).not.toHaveBeenCalled();
      expect(result).toEqual(expected);
    });

    it('should propagate BusinessException unchanged when draft preview fails', async () => {
      // 服务层在草稿项目或不存在时抛出统一 BusinessException
      const draftException = new BusinessException(BizCode.SCREEN_NOT_FOUND);
      service.findPublishedProjectById.mockRejectedValue(draftException);

      let caught: unknown;
      try {
        await controller.previewProject('draft-id');
      } catch (err) {
        caught = err;
      }

      // 控制器不应吞掉或包装异常,直接传播原异常
      expect(caught).toBe(draftException);
      expect(caught).toBeInstanceOf(BusinessException);
      const ex = caught as BusinessException;
      expect(ex.bizCode).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(ex.bizMessage).toBe('大屏项目不存在');
      expect(ex.details).toBeUndefined();
    });

    it('should not leak draft content through response body for draft preview', async () => {
      const draftException = new BusinessException(BizCode.SCREEN_NOT_FOUND);
      service.findPublishedProjectById.mockRejectedValue(draftException);

      let caught: unknown;
      try {
        await controller.previewProject('draft-id');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessException);
      const ex = caught as BusinessException;
      // 模拟 HttpExceptionFilter 序列化 BusinessException 后的响应体
      const responseBody: Record<string, unknown> = {
        code: ex.bizCode,
        message: ex.bizMessage,
      };
      if (ex.details) {
        responseBody.details = ex.details;
      }
      const serialized = JSON.stringify(responseBody);
      // 响应体形状严格符合 ApiErrorResponse:仅 code/message
      expect(Object.keys(responseBody).sort()).toEqual(['code', 'message']);
      expect(responseBody.code).toBe(BizCode.SCREEN_NOT_FOUND);
      expect(responseBody.message).toBe('大屏项目不存在');
      // 响应体不得包含任何草稿业务字段
      expect(serialized).not.toContain('canvas');
      expect(serialized).not.toContain('components');
      expect(serialized).not.toContain('description');
      expect(serialized).not.toContain('thumbnail');
      expect(serialized).not.toContain('name');
      expect(serialized).not.toContain('draft');
    });
  });

  describe('anonymous access metadata (@Public boundary)', () => {
    let reflector: Reflector;

    beforeAll(() => {
      reflector = new Reflector();
    });

    type ScreenProtectedMethod =
      | 'createProject'
      | 'findAllProjects'
      | 'findProjectById'
      | 'updateProject'
      | 'publishProject'
      | 'removeProject';

    const protectedEndpoints: ReadonlyArray<readonly [ScreenProtectedMethod, string]> = [
      ['createProject', 'POST /screen'],
      ['findAllProjects', 'GET /screen'],
      ['findProjectById', 'GET /screen/:id'],
      ['updateProject', 'PATCH /screen/:id'],
      ['publishProject', 'POST /screen/:id/publish'],
      ['removeProject', 'DELETE /screen/:id'],
    ];

    it('should not mark ScreenController class as @Public', () => {
      const isClassPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        ScreenController,
        ScreenController,
      ]);
      expect(isClassPublic).toBeFalsy();
    });

    for (const [methodName, endpoint] of protectedEndpoints) {
      it(`should not mark ${methodName} as @Public (protected: ${endpoint})`, () => {
        const handler = ScreenController.prototype[methodName] as (...args: unknown[]) => unknown;
        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          handler,
          ScreenController,
        ]);
        expect(isPublic).toBeFalsy();
      });
    }

    it('should mark previewProject as @Public (public preview)', () => {
      const handler = ScreenController.prototype['previewProject'] as (
        ...args: unknown[]
      ) => unknown;
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        ScreenController,
      ]);
      expect(isPublic).toBe(true);
    });
  });
});
