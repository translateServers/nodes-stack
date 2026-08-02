import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ScreenDocumentSchema } from '@nebula/shared';

import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetReferenceService } from '@/modules/dataset/dataset-reference.service';
import { PrismaService } from '@/prisma/prisma.service';

import type {
  CreateScreenProjectDto,
  PublishScreenProjectDto,
  UpdateScreenProjectDto,
} from './dto/screen.dto';
import { ScreenService } from './screen.service';

const baseline = '2026-08-02 00:00:00';
const defaultCanvas = {
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scaleMode: 'fit' as const,
};
const button = {
  id: 'button-1',
  type: 'button',
  name: 'Button',
  position: { x: 0, y: 0, width: 120, height: 40 },
  style: {},
  props: { text: 'Open' },
  status: { hidden: false, locked: false },
  zIndex: 1,
};

interface ScreenProjectEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly canvas: string;
  readonly components: string;
  readonly blueprint: string | null;
  readonly document: string | null;
  readonly status: string;
  readonly thumbnail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface CreateProjectArgs {
  readonly data: {
    readonly canvas: string;
    readonly components: string;
    readonly createdAt: Date;
    readonly description: string | null;
    readonly document: string;
    readonly name: string;
    readonly status: string;
    readonly updatedAt: Date;
  };
}

interface UpdateDocumentArgs {
  readonly where: { readonly id: string };
  readonly data: { readonly document: string };
}

interface UpdateManyProjectArgs {
  readonly where: { readonly id: string; readonly updatedAt: Date };
  readonly data: {
    readonly description?: string | null;
    readonly document?: string;
    readonly name?: string;
    readonly status: string;
    readonly thumbnail?: string | null;
    readonly updatedAt: Date;
  };
}

interface DeleteProjectArgs {
  readonly where: { readonly id: string };
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return ScreenDocumentSchema.parse({
    canvas: defaultCanvas,
    components: [button],
    globalVariables: [],
    ...overrides,
  });
}

function makeEntity(overrides: Partial<ScreenProjectEntity> = {}): ScreenProjectEntity {
  const document = makeDocument();
  return {
    id: 'project-1',
    name: 'Project',
    description: null,
    canvas: JSON.stringify(document.canvas),
    components: JSON.stringify(document.components),
    blueprint: null,
    document: JSON.stringify(document),
    status: 'draft',
    thumbnail: null,
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ScreenService', () => {
  let service: ScreenService;
  let prisma: {
    screenProject: {
      create: jest.Mock<Promise<ScreenProjectEntity>, [CreateProjectArgs]>;
      delete: jest.Mock<Promise<ScreenProjectEntity>, [DeleteProjectArgs]>;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock<Promise<ScreenProjectEntity | undefined>, [UpdateDocumentArgs]>;
      updateMany: jest.Mock<Promise<{ count: number }>, [UpdateManyProjectArgs]>;
    };
  };
  let datasetReferences: { rebuildReferences: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma = {
      screenProject: {
        create: jest.fn<Promise<ScreenProjectEntity>, [CreateProjectArgs]>(),
        delete: jest.fn<Promise<ScreenProjectEntity>, [DeleteProjectArgs]>(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn<Promise<ScreenProjectEntity | undefined>, [UpdateDocumentArgs]>(),
        updateMany: jest.fn<Promise<{ count: number }>, [UpdateManyProjectArgs]>(),
      },
    };
    datasetReferences = { rebuildReferences: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenService,
        { provide: PrismaService, useValue: prisma },
        { provide: DatasetReferenceService, useValue: datasetReferences },
      ],
    }).compile();
    service = module.get(ScreenService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createProject', () => {
    it('creates a canonical document with the default canvas', async () => {
      const dto: CreateScreenProjectDto = { name: 'New project' };
      prisma.screenProject.findUnique.mockResolvedValue(null);
      prisma.screenProject.create.mockResolvedValue(makeEntity({ name: dto.name }));

      const result = await service.createProject(dto);

      expect(result.canvas).toEqual(defaultCanvas);
      const createCall = prisma.screenProject.create.mock.calls[0]?.[0];
      expect(createCall?.data.name).toBe(dto.name);
      expect(createCall?.data.canvas).toBe('{}');
      expect(createCall?.data.components).toBe('[]');
      expect(createCall?.data.document).toContain('"components":[]');
      expect(createCall?.data.status).toBe('draft');
    });

    it('uses a supplied canvas and rejects duplicate names', async () => {
      const canvas = { ...defaultCanvas, width: 2560 };
      prisma.screenProject.findUnique.mockResolvedValue(null);
      prisma.screenProject.create.mockResolvedValue(
        makeEntity({ document: JSON.stringify(makeDocument({ canvas })) }),
      );

      await expect(service.createProject({ name: 'Custom', canvas })).resolves.toMatchObject({
        canvas,
      });

      prisma.screenProject.findUnique.mockResolvedValue(makeEntity({ name: 'Existing' }));
      await expect(service.createProject({ name: 'Existing' })).rejects.toMatchObject({
        bizCode: BizCode.SCREEN_NAME_EXISTS,
      });
    });
  });

  describe('read paths', () => {
    it('returns all projects and rejects missing projects', async () => {
      prisma.screenProject.findMany.mockResolvedValue([
        makeEntity({ id: 'first', name: 'First' }),
        makeEntity({ id: 'second', name: 'Second' }),
      ]);

      await expect(service.findAllProjects()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'first' }),
          expect.objectContaining({ id: 'second' }),
        ]),
      );

      prisma.screenProject.findUnique.mockResolvedValue(null);
      await expect(service.findProjectById('missing')).rejects.toMatchObject({
        bizCode: BizCode.SCREEN_NOT_FOUND,
      });
    });

    it('migrates historical columns into document on read', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(
        makeEntity({
          document: null,
          blueprint: JSON.stringify({
            version: 1,
            nodes: [
              {
                id: 'trigger',
                kind: 'trigger',
                position: { x: 0, y: 0 },
                config: { type: 'componentClick', componentId: button.id },
              },
            ],
            edges: [],
          }),
        }),
      );

      const project = await service.findProjectById('project-1');

      expect(project.blueprint?.version).toBe(2);
      const updateCall = prisma.screenProject.update.mock.calls[0]?.[0];
      expect(updateCall?.where).toEqual({ id: 'project-1' });
      expect(updateCall?.data.document).toContain('"version":2');
    });

    it('returns a canonical document without rewriting it', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity());

      const project = await service.findProjectById('project-1');

      expect(project.components).toEqual([button]);
      expect(prisma.screenProject.update).not.toHaveBeenCalled();
    });

    it('rejects malformed canonical and historical persisted data', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity({ document: '{invalid' }));
      await expect(service.findProjectById('project-1')).rejects.toMatchObject({
        bizCode: BizCode.VALIDATION_ERROR,
      });

      prisma.screenProject.findUnique.mockResolvedValue(
        makeEntity({ document: null, components: '{invalid' }),
      );
      await expect(service.findProjectById('project-1')).rejects.toMatchObject({
        bizCode: BizCode.VALIDATION_ERROR,
      });
    });

    it('returns only published projects and redacts sensitive API headers', async () => {
      const componentWithHeaders = {
        ...button,
        dataSource: {
          type: 'api' as const,
          apiConfig: {
            url: 'https://example.com/data',
            method: 'GET' as const,
            headers: { Authorization: 'Bearer secret', Accept: 'application/json' },
          },
        },
      };
      prisma.screenProject.findFirst.mockResolvedValue(
        makeEntity({
          status: 'published',
          document: JSON.stringify(makeDocument({ components: [componentWithHeaders] })),
        }),
      );

      const project = await service.findPublishedProjectById('project-1');

      expect(prisma.screenProject.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', status: 'published' },
      });
      expect(project.components[0]?.dataSource?.apiConfig?.headers).toEqual({
        Authorization: '[REDACTED]',
        Accept: 'application/json',
      });

      prisma.screenProject.findFirst.mockResolvedValue(null);
      await expect(service.findPublishedProjectById('draft')).rejects.toMatchObject({
        bizCode: BizCode.SCREEN_NOT_FOUND,
      });
    });
  });

  describe('updateProject', () => {
    it('writes a canonical document and rebuilds dataset references', async () => {
      const dto: UpdateScreenProjectDto = {
        name: 'Renamed',
        components: [{ ...button, name: 'Updated button' }],
        expectedUpdatedAt: baseline,
      };
      const current = makeEntity();
      const updated = makeEntity({
        name: dto.name,
        document: JSON.stringify(makeDocument({ components: dto.components })),
      });
      prisma.screenProject.findFirst.mockResolvedValue(null);
      prisma.screenProject.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
      prisma.screenProject.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateProject('project-1', dto);

      expect(result.name).toBe('Renamed');
      const updateCall = prisma.screenProject.updateMany.mock.calls[0]?.[0];
      expect(updateCall?.where).toEqual({ id: 'project-1', updatedAt: new Date(baseline) });
      expect(updateCall?.data.name).toBe('Renamed');
      expect(updateCall?.data.document).toContain('Updated button');
      expect(updateCall?.data.status).toBe('draft');
      expect(datasetReferences.rebuildReferences).toHaveBeenCalledWith('project-1', dto.components);
    });

    it('rejects duplicate names and missing projects before writing', async () => {
      prisma.screenProject.findFirst.mockResolvedValue(makeEntity({ id: 'other' }));
      await expect(
        service.updateProject('project-1', { name: 'Taken', expectedUpdatedAt: baseline }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NAME_EXISTS });
      expect(prisma.screenProject.updateMany).not.toHaveBeenCalled();

      prisma.screenProject.findFirst.mockResolvedValue(null);
      prisma.screenProject.findUnique.mockResolvedValue(null);
      await expect(
        service.updateProject('project-1', { description: 'Missing', expectedUpdatedAt: baseline }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NOT_FOUND });
    });

    it('distinguishes an optimistic-lock conflict from a missing project', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity());
      prisma.screenProject.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateProject('project-1', {
          description: 'Conflict',
          expectedUpdatedAt: baseline,
        }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_SAVE_CONFLICT });

      prisma.screenProject.findUnique
        .mockResolvedValueOnce(makeEntity())
        .mockResolvedValueOnce(null);
      await expect(
        service.updateProject('project-1', { description: 'Missing', expectedUpdatedAt: baseline }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NOT_FOUND });
    });

    it('migrates a historical blueprint input before persisting the document', async () => {
      const dto: UpdateScreenProjectDto = {
        blueprint: {
          version: 1,
          nodes: [
            {
              id: 'trigger',
              kind: 'trigger',
              position: { x: 0, y: 0 },
              config: { type: 'componentClick', componentId: button.id },
            },
            {
              id: 'action',
              kind: 'action',
              position: { x: 200, y: 0 },
              config: { type: 'setVisibility', targetComponentId: button.id, visible: 'hide' },
            },
          ],
          edges: [
            {
              id: 'edge',
              source: 'trigger',
              sourceHandle: 'out',
              target: 'action',
              targetHandle: 'in',
            },
          ],
        },
        expectedUpdatedAt: baseline,
      };
      prisma.screenProject.findUnique
        .mockResolvedValueOnce(makeEntity())
        .mockResolvedValueOnce(makeEntity());
      prisma.screenProject.updateMany.mockResolvedValue({ count: 1 });

      await service.updateProject('project-1', dto);

      const updateCall = prisma.screenProject.updateMany.mock.calls[0]?.[0];
      expect(updateCall?.data.document).toContain('"version":2');
      expect(updateCall?.data.document).toContain('"blueprint-trigger-trigger"');
    });

    it('rejects a historical blueprint that cannot be migrated without loss', async () => {
      const dto: UpdateScreenProjectDto = {
        blueprint: {
          version: 1,
          nodes: [
            {
              id: 'trigger',
              kind: 'trigger',
              position: { x: 0, y: 0 },
              config: { type: 'componentClick', componentId: button.id },
            },
            {
              id: 'action',
              kind: 'action',
              position: { x: 200, y: 0 },
              config: { type: 'setVisibility', targetComponentId: button.id, visible: 'hide' },
            },
          ],
          edges: [
            {
              id: 'first',
              source: 'trigger',
              sourceHandle: 'out',
              target: 'action',
              targetHandle: 'in',
            },
            {
              id: 'cycle',
              source: 'action',
              sourceHandle: 'out',
              target: 'action',
              targetHandle: 'in',
            },
          ],
        },
        expectedUpdatedAt: baseline,
      };
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity());

      await expect(service.updateProject('project-1', dto)).rejects.toMatchObject({
        bizCode: BizCode.VALIDATION_ERROR,
      });
      expect(prisma.screenProject.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('publishProject and removeProject', () => {
    it('publishes with an optimistic lock and returns the updated project', async () => {
      const dto: PublishScreenProjectDto = { expectedUpdatedAt: baseline };
      prisma.screenProject.updateMany.mockResolvedValue({ count: 1 });
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity({ status: 'published' }));

      await expect(service.publishProject('project-1', dto)).resolves.toMatchObject({
        status: 'published',
      });
      const updateCall = prisma.screenProject.updateMany.mock.calls[0]?.[0];
      expect(updateCall?.where).toEqual({ id: 'project-1', updatedAt: new Date(baseline) });
      expect(updateCall?.data.status).toBe('published');
    });

    it('reports publish conflicts and missing projects', async () => {
      prisma.screenProject.updateMany.mockResolvedValue({ count: 0 });
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity());
      await expect(
        service.publishProject('project-1', { expectedUpdatedAt: baseline }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_SAVE_CONFLICT });

      prisma.screenProject.findUnique.mockResolvedValue(null);
      await expect(
        service.publishProject('missing', { expectedUpdatedAt: baseline }),
      ).rejects.toMatchObject({ bizCode: BizCode.SCREEN_NOT_FOUND });
    });

    it('deletes an existing project and rejects a missing one', async () => {
      prisma.screenProject.findUnique.mockResolvedValue(makeEntity());
      prisma.screenProject.delete.mockResolvedValue(makeEntity());

      await expect(service.removeProject('project-1')).resolves.toBeUndefined();
      expect(prisma.screenProject.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } });

      prisma.screenProject.findUnique.mockResolvedValue(null);
      await expect(service.removeProject('missing')).rejects.toBeInstanceOf(BusinessException);
    });
  });
});
