import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { EMPTY_SCREEN_DOCUMENT } from '@nebula/shared';

import { BizCode } from '@/common/enums/biz-code.enum';
import { PrismaService } from '@/prisma/prisma.service';

import type {
  CreateScreenProjectDto,
  PublishScreenProjectDto,
  UpdateScreenProjectDto,
} from './dto/screen.dto';
import { ScreenService } from './screen.service';

const baseline = '2026-08-03 00:00:00';

interface ScreenProjectEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly document: string;
  readonly status: string;
  readonly thumbnail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function documentWithTitle(title: string) {
  return {
    ...EMPTY_SCREEN_DOCUMENT,
    canvas: { ...EMPTY_SCREEN_DOCUMENT.canvas },
    components: [
      {
        id: 'metric-1',
        type: 'nebula.metric/v1',
        name: 'Metric',
        position: { x: 0, y: 0, width: 200, height: 100 },
        style: {},
        props: { title },
        status: { locked: false, hidden: false },
        zIndex: 1,
      },
    ],
  };
}

function makeEntity(overrides: Partial<ScreenProjectEntity> = {}): ScreenProjectEntity {
  return {
    id: 'project-1',
    name: 'Project',
    description: null,
    document: JSON.stringify(documentWithTitle('Initial')),
    status: 'draft',
    thumbnail: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ScreenService', () => {
  let service: ScreenService;
  let prisma: {
    screenProject: {
      create: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma = {
      screenProject: {
        create: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScreenService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ScreenService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates and returns a nested canonical document', async () => {
    const dto: CreateScreenProjectDto = { name: 'New project' };
    prisma.screenProject.findUnique.mockResolvedValue(null);
    prisma.screenProject.create.mockResolvedValue(makeEntity({ name: dto.name }));

    const result = await service.createProject(dto);

    expect(result.document).toEqual(documentWithTitle('Initial'));
    expect(prisma.screenProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          document: JSON.stringify(EMPTY_SCREEN_DOCUMENT),
          name: dto.name,
        }),
      }),
    );
    expect(result).not.toHaveProperty('canvas');
    expect(result).not.toHaveProperty('components');
  });

  it('atomically replaces document while null explicitly clears metadata', async () => {
    const replacement = documentWithTitle('Replacement');
    const dto: UpdateScreenProjectDto = {
      expectedUpdatedAt: baseline,
      description: null,
      thumbnail: null,
      document: replacement,
    };
    prisma.screenProject.findUnique
      .mockResolvedValueOnce(makeEntity())
      .mockResolvedValueOnce(makeEntity({ document: JSON.stringify(replacement) }));
    prisma.screenProject.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateProject('project-1', dto);

    expect(result.document).toEqual(replacement);
    expect(prisma.screenProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          document: JSON.stringify(replacement),
          thumbnail: null,
        }),
      }),
    );
  });

  it('preserves a document when PATCH omits it', async () => {
    const current = makeEntity();
    const dto: UpdateScreenProjectDto = { expectedUpdatedAt: baseline, name: 'Renamed' };
    prisma.screenProject.findFirst.mockResolvedValue(null);
    prisma.screenProject.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    prisma.screenProject.updateMany.mockResolvedValue({ count: 1 });

    await service.updateProject('project-1', dto);

    expect(prisma.screenProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ document: current.document }) }),
    );
  });

  it('fails closed for invalid persisted document and distinguishes publish conflicts', async () => {
    prisma.screenProject.findUnique.mockResolvedValue(makeEntity({ document: '{invalid' }));
    await expect(service.findProjectById('project-1')).rejects.toMatchObject({
      bizCode: BizCode.VALIDATION_ERROR,
    });

    const dto: PublishScreenProjectDto = { expectedUpdatedAt: baseline };
    prisma.screenProject.updateMany.mockResolvedValue({ count: 0 });
    prisma.screenProject.findUnique.mockResolvedValue(makeEntity());
    await expect(service.publishProject('project-1', dto)).rejects.toMatchObject({
      bizCode: BizCode.SCREEN_SAVE_CONFLICT,
    });
  });
});
