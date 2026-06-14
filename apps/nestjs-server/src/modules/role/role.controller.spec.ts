import { Test, type TestingModule } from '@nestjs/testing';
import { RoleController } from '@/modules/role/role.controller';
import { RoleService } from '@/modules/role/role.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  AssignMenusDto,
  RoleResponse,
} from '@/modules/role/dto/role.dto';

const mockRoleService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  assignMenus: jest.fn(),
};

function makeRoleResponse(overrides: Partial<RoleResponse> = {}): RoleResponse {
  return {
    id: overrides.id ?? 'role-id',
    name: overrides.name ?? '测试角色',
    description: overrides.description ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? '2025-06-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-06-01T10:00:00.000Z',
  };
}

describe('RoleController', () => {
  let controller: RoleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [{ provide: RoleService, useValue: mockRoleService }],
    }).compile();

    controller = module.get<RoleController>(RoleController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should return created RoleResponse', async () => {
      const dto: CreateRoleDto = { name: '新角色' };
      const expected = makeRoleResponse({ name: '新角色' });
      mockRoleService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(mockRoleService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return array of RoleResponse', async () => {
      const expected = [
        makeRoleResponse({ id: '1', name: 'a' }),
        makeRoleResponse({ id: '2', name: 'b' }),
      ];
      mockRoleService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(mockRoleService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });

    it('should return empty array when no roles', async () => {
      mockRoleService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return role by id', async () => {
      const expected = makeRoleResponse({ id: 'r-1' });
      mockRoleService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('r-1');

      expect(mockRoleService.findOne).toHaveBeenCalledWith('r-1');
      expect(result.id).toBe('r-1');
    });

    it('should propagate BusinessException when not found', async () => {
      mockRoleService.findOne.mockRejectedValue(new BusinessException(BizCode.ROLE_NOT_FOUND));

      await expect(controller.findOne('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should delegate update to roleService', async () => {
      const dto: UpdateRoleDto = { name: '更新后' };
      const expected = makeRoleResponse({ id: 'u', name: '更新后' });
      mockRoleService.update.mockResolvedValue(expected);

      const result = await controller.update('u', dto);

      expect(mockRoleService.update).toHaveBeenCalledWith('u', dto);
      expect(result.name).toBe('更新后');
    });
  });

  describe('remove', () => {
    it('should call roleService.remove', async () => {
      mockRoleService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('del');

      expect(mockRoleService.remove).toHaveBeenCalledWith('del');
      expect(result).toBeUndefined();
    });
  });

  describe('assignMenus', () => {
    it('should delegate to roleService.assignMenus', async () => {
      const dto: AssignMenusDto = { menuIds: ['m1', 'm2'] };
      const expected = makeRoleResponse({ id: 'r' });
      mockRoleService.assignMenus.mockResolvedValue(expected);

      const result = await controller.assignMenus('r', dto);

      expect(mockRoleService.assignMenus).toHaveBeenCalledWith('r', dto);
      expect(result.id).toBe('r');
    });
  });
});
