import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ScreenController } from '@/modules/screen/screen.controller';
import { ScreenResourceService } from '@/modules/screen/screen-resource.service';
import { ScreenService } from '@/modules/screen/screen.service';

import type {
  ExecuteScreenHostResourceDto,
  ListScreenHostResourcesQueryDto,
} from './dto/screen.dto';

describe('ScreenController host resource gateway', () => {
  let controller: ScreenController;
  const screenService = {
    createProject: jest.fn(),
    findAllProjects: jest.fn(),
    findProjectById: jest.fn(),
    findPublishedProjectById: jest.fn(),
    updateProject: jest.fn(),
    publishProject: jest.fn(),
    removeProject: jest.fn(),
  };
  const resourceService = {
    listResources: jest.fn(),
    executeResource: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenController],
      providers: [
        { provide: ScreenService, useValue: screenService },
        { provide: ScreenResourceService, useValue: resourceService },
      ],
    }).compile();
    controller = module.get(ScreenController);
    jest.clearAllMocks();
  });

  it('dispatches authenticated resource list and execute through the fixed gateway', async () => {
    const query: ListScreenHostResourcesQueryDto = { resourceType: 'metric' };
    const request: ExecuteScreenHostResourceDto = {
      contextId: 'design-1',
      componentId: 'metric-1',
      intent: { resourceType: 'metric', resourceId: 'dataset-1' },
    };
    resourceService.listResources.mockResolvedValue([]);
    resourceService.executeResource.mockResolvedValue({ data: { value: 1 } });

    await expect(controller.listResources('project-1', query)).resolves.toEqual([]);
    await expect(controller.executeResource('project-1', request)).resolves.toEqual({
      data: { value: 1 },
    });

    expect(resourceService.listResources).toHaveBeenCalledWith('project-1', 'metric');
    expect(resourceService.executeResource).toHaveBeenCalledWith('project-1', request, false);
  });

  it('keeps only preview resource execute public', async () => {
    const reflector = new Reflector();
    const executeHandler = ScreenController.prototype.executeResource as (
      ...args: unknown[]
    ) => unknown;
    const previewHandler = ScreenController.prototype.executePreviewResource as (
      ...args: unknown[]
    ) => unknown;
    const request: ExecuteScreenHostResourceDto = {
      contextId: 'preview-1',
      componentId: 'metric-1',
      intent: { resourceType: 'metric', resourceId: 'dataset-1' },
    };
    resourceService.executeResource.mockResolvedValue({ data: null });

    expect(
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [executeHandler, ScreenController]),
    ).toBeFalsy();
    expect(
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [previewHandler, ScreenController]),
    ).toBe(true);

    await expect(controller.executePreviewResource('project-1', request)).resolves.toEqual({
      data: null,
    });
    expect(resourceService.executeResource).toHaveBeenCalledWith('project-1', request, true);
  });
});
