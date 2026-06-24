import { Test, type TestingModule } from '@nestjs/testing';
import { MenuController } from '@/modules/menu/menu.controller';
import { MenuService } from '@/modules/menu/menu.service';
import type { CreateMenuDto, UpdateMenuDto, MenuResponse } from '@/modules/menu/dto/menu.dto';

const mockMenuService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findTree: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

function createMenuResponse(overrides: Partial<MenuResponse> = {}): MenuResponse {
  return {
    id: 'menu-id',
    name: '系统管理',
    type: 'MENU',
    path: '/system',
    icon: 'Settings',
    component: '/pages/System.tsx',
    parentId: null,
    sort: 1,
    permission: 'system:manage',
    isVisible: true,
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('MenuController', () => {
  let controller: MenuController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenuController],
      providers: [
        {
          provide: MenuService,
          useValue: mockMenuService,
        },
      ],
    }).compile();

    controller = module.get<MenuController>(MenuController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call menuService.create and return the result', async () => {
      const dto: CreateMenuDto = {
        name: '用户管理',
        type: 'MENU',
        path: '/users',
      };
      const expected = createMenuResponse({ id: 'new-menu', name: dto.name, path: dto.path });
      mockMenuService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(mockMenuService.create).toHaveBeenCalledTimes(1);
      expect(mockMenuService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return an array of menus', async () => {
      const m1 = createMenuResponse({ id: '1', name: '菜单1' });
      const m2 = createMenuResponse({ id: '2', name: '菜单2' });
      mockMenuService.findAll.mockResolvedValue([m1, m2]);

      const result = await controller.findAll();

      expect(mockMenuService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no menus exist', async () => {
      mockMenuService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findTree', () => {
    it('should return hierarchical tree from service', async () => {
      const tree = [
        {
          ...createMenuResponse({ id: 'root', name: '根菜单' }),
          children: [
            {
              ...createMenuResponse({ id: 'child', name: '子菜单', parentId: 'root' }),
              children: [],
            },
          ],
        },
      ];
      mockMenuService.findTree.mockResolvedValue(tree);

      const result = await controller.findTree();

      expect(mockMenuService.findTree).toHaveBeenCalledTimes(1);
      expect(result[0].id).toBe('root');
      expect(result[0].children).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a single menu by id', async () => {
      const expected = createMenuResponse({ id: 'specific' });
      mockMenuService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('specific');

      expect(mockMenuService.findOne).toHaveBeenCalledWith('specific');
      expect(result.id).toBe('specific');
    });
  });

  describe('update', () => {
    it('should call menuService.update with correct arguments', async () => {
      const dto: UpdateMenuDto = { name: '新名称', sort: 99 };
      const expected = createMenuResponse({ id: 'update-me', name: '新名称', sort: 99 });
      mockMenuService.update.mockResolvedValue(expected);

      const result = await controller.update('update-me', dto);

      expect(mockMenuService.update).toHaveBeenCalledWith('update-me', dto);
      expect(result).toEqual(expected);
    });

    it('should handle partial updates (only isVisible changed)', async () => {
      const dto: UpdateMenuDto = { isVisible: false };
      const expected = createMenuResponse({ isVisible: false });
      mockMenuService.update.mockResolvedValue(expected);

      const result = await controller.update('toggle-id', dto);

      expect(mockMenuService.update).toHaveBeenCalledWith('toggle-id', dto);
      expect(result.isVisible).toBe(false);
    });
  });

  describe('remove', () => {
    it('should call menuService.remove and return undefined', async () => {
      mockMenuService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('delete-me');

      expect(mockMenuService.remove).toHaveBeenCalledWith('delete-me');
      expect(result).toBeUndefined();
    });
  });

  describe('data consistency', () => {
    it('should keep MenuResponse shape (type, isVisible, parentId)', async () => {
      const item = createMenuResponse({
        id: 'child-1',
        name: '子菜单',
        type: 'BUTTON',
        parentId: 'parent-id',
      });
      mockMenuService.findAll.mockResolvedValue([item]);

      const [result] = await controller.findAll();

      expect(result.type).toBe('BUTTON');
      expect(result.parentId).toBe('parent-id');
      expect(typeof result.isVisible).toBe('boolean');
      expect(typeof result.sort).toBe('number');
    });
  });
});
