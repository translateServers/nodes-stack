import { Test, type TestingModule } from '@nestjs/testing';

import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetService } from '@/modules/dataset/dataset.service';
import { PrismaService } from '@/prisma/prisma.service';

import { ScreenResourceService } from './screen-resource.service';

describe('ScreenResourceService', () => {
  let service: ScreenResourceService;
  const prisma = {
    screenProject: {
      findUnique: jest.fn(),
    },
  };
  const datasets = {
    executeMetricHostResource: jest.fn(),
    listMetricHostResources: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenResourceService,
        { provide: PrismaService, useValue: prisma },
        { provide: DatasetService, useValue: datasets },
      ],
    }).compile();
    service = module.get(ScreenResourceService);
    jest.clearAllMocks();
  });

  function request(overrides: Record<string, unknown> = {}) {
    return {
      contextId: 'context-1',
      componentId: 'component-1',
      intent: { resourceType: 'metric', resourceId: 'dataset-1' },
      ...overrides,
    };
  }

  it('rejects non-metric resources before querying datasets', async () => {
    prisma.screenProject.findUnique.mockResolvedValue({ id: 'project-1', status: 'draft' });

    await expect(service.listResources('project-1', 'unknown')).rejects.toMatchObject({
      bizCode: BizCode.VALIDATION_ERROR,
    });
    expect(datasets.listMetricHostResources).not.toHaveBeenCalled();
  });

  it('rejects unallowlisted metric params and binding fields', async () => {
    prisma.screenProject.findUnique.mockResolvedValue({ id: 'project-1', status: 'draft' });

    await expect(
      service.executeResource(
        'project-1',
        request({
          intent: { resourceType: 'metric', resourceId: 'dataset-1', params: { tenant: 'other' } },
        }),
        false,
      ),
    ).rejects.toMatchObject({ bizCode: BizCode.VALIDATION_ERROR });
    expect(datasets.executeMetricHostResource).not.toHaveBeenCalled();
  });

  it('requires a published project for anonymous preview execution', async () => {
    prisma.screenProject.findUnique.mockResolvedValue({ id: 'project-1', status: 'draft' });

    await expect(service.executeResource('project-1', request(), true)).rejects.toMatchObject({
      bizCode: BizCode.SCREEN_NOT_FOUND,
    });
    expect(datasets.executeMetricHostResource).not.toHaveBeenCalled();
  });

  it('does not turn a cross-project Dataset rejection into a successful response', async () => {
    prisma.screenProject.findUnique.mockResolvedValue({ id: 'project-1', status: 'published' });
    datasets.executeMetricHostResource.mockRejectedValue(
      new BusinessException(BizCode.SCREEN_NOT_FOUND),
    );

    await expect(service.executeResource('project-1', request(), false)).rejects.toMatchObject({
      bizCode: BizCode.SCREEN_NOT_FOUND,
    });
    expect(datasets.executeMetricHostResource).toHaveBeenCalledWith(
      'project-1',
      'dataset-1',
      false,
    );
  });

  it('returns a detached bounded JSON response and rejects responses over 1 MiB', async () => {
    prisma.screenProject.findUnique.mockResolvedValue({ id: 'project-1', status: 'published' });
    const source = { value: 7 };
    datasets.executeMetricHostResource.mockResolvedValue(source);

    const result = await service.executeResource('project-1', request(), false);
    expect(result).toEqual({ data: source });
    expect(result.data).not.toBe(source);

    datasets.executeMetricHostResource.mockResolvedValue('x'.repeat(1_048_577));
    await expect(service.executeResource('project-1', request(), false)).rejects.toMatchObject({
      bizCode: BizCode.VALIDATION_ERROR,
    });
  });
});
