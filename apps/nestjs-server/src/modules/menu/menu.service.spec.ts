import { Test, type TestingModule } from '@nestjs/testing';
import { MenuService } from '@/modules/menu/menu.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { CreateMenuDto, UpdateMenuDto } from '@/modules/menu/dto/menu.dto';
import type { Menu } from '@prisma/client';

const mockPrismaService = {
  menu: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

function createMenuEntity(overrides: Partial<Menu> = {}): Menu {
  const now = new Date('2025-06-01T10:00:00.000Z');
  return {
    id: 'menu-id',
    parentId: null,
    name: '系统管理',
    path: '/system',
    icon: 'Settings',
    type: 'MENU',
    sort: 1,
    isActive: true,
    permission: 'system:manage',
    component: '/pages/System.tsx',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new menu and return MenuResponse', async () => {
      const createMenuDto: CreateMenuDto = {
        name: '用户管理',
        type: 'MENU',
        path: '/users',
        icon: 'Users',
      };

      const entity = createMenuEntity({
        name: createMenuDto.name,
        path: createMenuDto.path,
        icon: createMenuDto.icon,
        type: createMenuDto.type,
      });
      mockPrismaService.menu.create.mockResolvedValue(entity);

      const result = await service.create(createMenuDto);

      expect(mockPrismaService.menu.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.menu.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: createMenuDto.name,
            path: createMenuDto.path,
            icon: createMenuDto.icon,
            type: createMenuDto.type,
            sort: 0,
            isActive: true,
            parentId: null,
            permission: null,
            component: null,
          }) as object,
        }) as object,
      );
      expect(result.name).toBe(createMenuDto.name);
      expect(result.type).toBe(createMenuDto.type);
      expect(result.isVisible).toBe(true);
      expect(typeof result.createdAt).toBe('string');
    });

    it('should use sort and isVisible when provided in create', async () => {
      const createMenuDto: CreateMenuDto = {
        name: '权限管理',
        type: 'MENU',
        sort: 5,
        isVisible: false,
      };

      const entity = createMenuEntity({
        name: createMenuDto.name,
        sort: createMenuDto.sort,
        isActive: false,
      });
      mockPrismaService.menu.create.mockResolvedValue(entity);

      const result = await service.create(createMenuDto);

      expect(mockPrismaService.menu.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sort: 5,
            isActive: false,
          }) as object,
        }) as object,
      );
      expect(result.isVisible).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return array of menus as MenuResponse', async () => {
      const entity1 = createMenuEntity({ id: 'm1', name: '菜单1' });
      const entity2 = createMenuEntity({ id: 'm2', name: '菜单2' });
      mockPrismaService.menu.findMany.mockResolvedValue([entity1, entity2]);

      const result = await service.findAll();

      expect(mockPrismaService.menu.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith({
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('菜单1');
    });

    it('should return empty array when no menus exist', async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return menu by id', async () => {
      const entity = createMenuEntity({ id: 'target-id', name: '目标菜单' });
      mockPrismaService.menu.findUnique.mockResolvedValue(entity);

      const result = await service.findOne('target-id');

      expect(mockPrismaService.menu.findUnique).toHaveBeenCalledWith({
        where: { id: 'target-id' },
      });
      expect(result.id).toBe('target-id');
      expect(result.name).toBe('目标菜单');
    });

    it('should throw BusinessException when menu not found', async () => {
      mockPrismaService.menu.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('findTree', () => {
    it('should build a hierarchical tree from flat menu list', async () => {
      const parent = createMenuEntity({
        id: 'parent',
        name: '系统管理',
        parentId: null,
        type: 'DIRECTORY',
      });
      const child = createMenuEntity({
        id: 'child',
        name: '用户管理',
        parentId: 'parent',
        type: 'MENU',
      });

      mockPrismaService.menu.findMany.mockResolvedValue([parent, child]);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parent');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].id).toBe('child');
    });

    it('should return multiple roots when no parentId', async () => {
      const m1 = createMenuEntity({ id: 'a', name: 'A', parentId: null });
      const m2 = createMenuEntity({ id: 'b', name: 'B', parentId: null });
      mockPrismaService.menu.findMany.mockResolvedValue([m1, m2]);

      const result = await service.findTree();

      expect(result).toHaveLength(2);
      expect(result[0].children).toEqual([]);
      expect(result[1].children).toEqual([]);
    });

    it('should handle deep nesting (3 levels)', async () => {
      const root = createMenuEntity({ id: 'r', name: 'R', parentId: null });
      const mid = createMenuEntity({ id: 'm', name: 'M', parentId: 'r' });
      const leaf = createMenuEntity({ id: 'l', name: 'L', parentId: 'm' });

      mockPrismaService.menu.findMany.mockResolvedValue([root, mid, leaf]);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(result[0].children?.[0].children?.[0].id).toBe('l');
    });

    it('should return empty array for empty database', async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([]);

      const result = await service.findTree();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update menu fields', async () => {
      const original = createMenuEntity({ id: 'u1', name: '旧名称', sort: 1, isActive: true });
      const updated = createMenuEntity({
        id: 'u1',
        name: '新名称',
        sort: 99,
        isActive: false,
      });

      mockPrismaService.menu.findUnique.mockResolvedValue(original);
      mockPrismaService.menu.update.mockResolvedValue(updated);

      const updateDto: UpdateMenuDto = {
        name: '新名称',
        sort: 99,
        isVisible: false,
      };

      const result = await service.update('u1', updateDto);

      expect(mockPrismaService.menu.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.menu.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ name: '新名称', sort: 99, isActive: false }) as object,
        }) as object,
      );
      expect(result.name).toBe('新名称');
      expect(result.isVisible).toBe(false);
    });

    it('should convert isVisible to isActive in update', async () => {
      const original = createMenuEntity({ id: 'u2', isActive: true });
      const updated = createMenuEntity({ id: 'u2', isActive: false });

      mockPrismaService.menu.findUnique.mockResolvedValue(original);
      mockPrismaService.menu.update.mockResolvedValue(updated);

      await service.update('u2', { isVisible: false });

      expect(mockPrismaService.menu.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u2' },
          data: { isActive: false },
        }),
      );
    });

    it('should throw BusinessException when updating non-existent menu', async () => {
      mockPrismaService.menu.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: '不会更新' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('should only update provided fields (partial update)', async () => {
      const original = createMenuEntity({
        id: 'u3',
        name: '系统',
        path: '/system',
        icon: 'Icon',
        sort: 1,
      });
      const updated = createMenuEntity({
        id: 'u3',
        name: '系统',
        path: '/system',
        icon: 'Icon',
        sort: 5,
      });

      mockPrismaService.menu.findUnique.mockResolvedValue(original);
      mockPrismaService.menu.update.mockResolvedValue(updated);

      await service.update('u3', { sort: 5 });

      expect(mockPrismaService.menu.update).toHaveBeenCalledWith({
        where: { id: 'u3' },
        data: { sort: 5 },
      });
    });

    it('should update all optional fields when provided', async () => {
      const original = createMenuEntity({ id: 'u4' });
      const updated = createMenuEntity({
        id: 'u4',
        name: '新名称',
        path: '/new-path',
        icon: 'NewIcon',
        parentId: 'parent-id',
        type: 'BUTTON',
        permission: 'new:perm',
        component: '/pages/New.tsx',
        sort: 3,
        isActive: true,
      });

      mockPrismaService.menu.findUnique.mockResolvedValue(original);
      mockPrismaService.menu.update.mockResolvedValue(updated);

      const updateDto: UpdateMenuDto = {
        name: '新名称',
        path: '/new-path',
        icon: 'NewIcon',
        parentId: 'parent-id',
        type: 'BUTTON',
        permission: 'new:perm',
        component: '/pages/New.tsx',
        sort: 3,
        isVisible: true,
      };

      const result = await service.update('u4', updateDto);

      expect(mockPrismaService.menu.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u4' },
          data: expect.objectContaining({
            name: '新名称',
            path: '/new-path',
            icon: 'NewIcon',
            parentId: 'parent-id',
            type: 'BUTTON',
            permission: 'new:perm',
            component: '/pages/New.tsx',
            sort: 3,
            isActive: true,
          }) as object,
        }) as object,
      );
    });
  });

  describe('remove', () => {
    it('should remove menu by id', async () => {
      const target = createMenuEntity({ id: 'del1' });
      mockPrismaService.menu.findUnique.mockResolvedValue(target);
      mockPrismaService.menu.delete.mockResolvedValue(target);

      const result = await service.remove('del1');

      expect(mockPrismaService.menu.findUnique).toHaveBeenCalledWith({
        where: { id: 'del1' },
      });
      expect(mockPrismaService.menu.delete).toHaveBeenCalledWith({
        where: { id: 'del1' },
      });
      expect(result).toBeUndefined();
    });

    it('should throw BusinessException when removing non-existent menu', async () => {
      mockPrismaService.menu.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('toResponse transformation', () => {
    it('should format Date as YYYY-MM-DD HH:mm:ss and map isActive to isVisible', async () => {
      const now = new Date(2025, 5, 1, 10, 0, 0);
      const entity = createMenuEntity({
        id: 'resp-test',
        name: '响应测试',
        type: 'DIRECTORY',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      mockPrismaService.menu.findUnique.mockResolvedValue(entity);

      const result = await service.findOne('resp-test');

      expect(result.id).toBe('resp-test');
      expect(result.isVisible).toBe(true);
      expect(result.createdAt).toBe('2025-06-01 10:00:00');
      expect(result.updatedAt).toBe('2025-06-01 10:00:00');
      expect(result.type).toBe('DIRECTORY');
    });

    it('should pass null values for optional fields unchanged', async () => {
      const entity = createMenuEntity({
        id: 'opt-test',
        path: null,
        icon: null,
        parentId: null,
        permission: null,
        component: null,
      });

      mockPrismaService.menu.findUnique.mockResolvedValue(entity);

      const result = await service.findOne('opt-test');

      expect(result.path).toBeNull();
      expect(result.icon).toBeNull();
      expect(result.parentId).toBeNull();
      expect(result.permission).toBeNull();
      expect(result.component).toBeNull();
    });
  });
});
