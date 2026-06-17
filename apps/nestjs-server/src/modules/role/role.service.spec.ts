import { Test, type TestingModule } from '@nestjs/testing';
import { RoleService } from '@/modules/role/role.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { CreateRoleDto, UpdateRoleDto, AssignMenusDto } from '@/modules/role/dto/role.dto';

interface RoleEntity {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mockPrismaService = {
  role: {
    create: jest.fn<Promise<RoleEntity>, [unknown]>(),
    findMany: jest.fn<Promise<RoleEntity[]>, []>(),
    findUnique: jest.fn<Promise<RoleEntity | null>, [unknown]>(),
    findFirst: jest.fn<Promise<RoleEntity | null>, [unknown]>(),
    update: jest.fn<Promise<RoleEntity>, [unknown]>(),
    delete: jest.fn<Promise<RoleEntity>, [unknown]>(),
  },
  menu: {
    findMany: jest.fn<Promise<{ id: string }[]>, [unknown]>(),
  },
};

function makeRole(overrides: Partial<RoleEntity> = {}): RoleEntity {
  const now = new Date('2025-06-01T10:00:00.000Z');
  return {
    id: overrides.id ?? 'role-id',
    name: overrides.name ?? '管理员',
    description: overrides.description ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<RoleService>(RoleService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a role and return RoleResponse', async () => {
      const dto: CreateRoleDto = { name: '新角色', description: '测试描述' };
      mockPrismaService.role.create.mockResolvedValue(
        makeRole({ name: dto.name, description: dto.description ?? null }),
      );

      const result = await service.create(dto);

      expect(mockPrismaService.role.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '新角色', description: '测试描述' }) as object,
        }) as object,
      );
      expect(result.name).toBe('新角色');
      expect(typeof result.createdAt).toBe('string');
    });

    it('should set description to null when not provided', async () => {
      const dto: CreateRoleDto = { name: '角色A' };
      mockPrismaService.role.create.mockResolvedValue(makeRole({ name: '角色A' }));

      await service.create(dto);

      expect(mockPrismaService.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }) as object,
        }) as object,
      );
    });

    it('should throw BusinessException when name already exists', async () => {
      const dto: CreateRoleDto = { name: '已存在' };
      mockPrismaService.role.findUnique.mockResolvedValue(makeRole({ name: '已存在' }));

      await expect(service.create(dto)).rejects.toThrow(BusinessException);
    });
  });

  describe('findAll', () => {
    it('should return RoleResponse array', async () => {
      const roles: RoleEntity[] = [
        makeRole({ id: '1', name: 'a' }),
        makeRole({ id: '2', name: 'b' }),
      ];
      mockPrismaService.role.findMany.mockResolvedValue(roles);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].name).toBe('b');
    });

    it('should return empty array when no roles', async () => {
      mockPrismaService.role.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return RoleResponse for valid id', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue(makeRole({ id: 'find-id' }));

      const result = await service.findOne('find-id');

      expect(result.id).toBe('find-id');
      expect(mockPrismaService.role.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'find-id' } }),
      );
    });

    it('should throw BusinessException when not found', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should update role name', async () => {
      const dto: UpdateRoleDto = { name: '更新后的角色' };
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'u' }));
      mockPrismaService.role.update.mockResolvedValue(makeRole({ id: 'u', name: '更新后的角色' }));

      const result = await service.update('u', dto);

      expect(mockPrismaService.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u' },
          data: expect.objectContaining({ name: '更新后的角色' }) as object,
        }) as object,
      );
      expect(result.name).toBe('更新后的角色');
    });

    it('should throw BusinessException when name duplicate', async () => {
      const dto: UpdateRoleDto = { name: '冲突的名字' };
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'u' }));
      mockPrismaService.role.findFirst.mockResolvedValueOnce(makeRole({ id: 'other' }));

      await expect(service.update('u', dto)).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException when id not found', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(BusinessException);
    });

    it('should update description when provided', async () => {
      const dto: UpdateRoleDto = { description: '新描述' };
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'u' }));
      mockPrismaService.role.update.mockResolvedValue(makeRole({ id: 'u', description: '新描述' }));

      const result = await service.update('u', dto);

      expect(result.description).toBe('新描述');
      expect(mockPrismaService.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: '新描述' }) as object,
        }) as object,
      );
    });

    it('should skip name duplicate check when name is empty string', async () => {
      const dto: UpdateRoleDto = { name: '' };
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'u' }));
      mockPrismaService.role.update.mockResolvedValue(makeRole({ id: 'u', name: '' }));

      await service.update('u', dto);

      expect(mockPrismaService.role.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should call prisma.role.delete with id', async () => {
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'del' }));
      mockPrismaService.role.delete.mockResolvedValue(makeRole({ id: 'del' }));

      await service.remove('del');

      expect(mockPrismaService.role.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'del' } }),
      );
    });

    it('should throw BusinessException when role not found', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('assignMenus', () => {
    it('should assign menu ids to role', async () => {
      const dto: AssignMenusDto = { menuIds: ['m1', 'm2'] };
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'r' }));
      mockPrismaService.menu.findMany.mockResolvedValueOnce([{ id: 'm1' }, { id: 'm2' }]);
      mockPrismaService.role.update.mockResolvedValueOnce(makeRole({ id: 'r' }));

      await service.assignMenus('r', dto);

      expect(mockPrismaService.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r' },
          data: expect.objectContaining({
            menus: expect.objectContaining({
              set: [{ id: 'm1' }, { id: 'm2' }],
            }) as object,
          }) as object,
        }) as object,
      );
    });

    it('should skip menu validation when menuIds is empty', async () => {
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'r' }));
      mockPrismaService.role.update.mockResolvedValueOnce(makeRole({ id: 'r' }));

      await service.assignMenus('r', { menuIds: [] });

      expect(mockPrismaService.menu.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            menus: { set: [] },
          }) as object,
        }) as object,
      );
    });

    it('should throw BusinessException when role not found', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      await expect(service.assignMenus('missing', { menuIds: [] })).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException when any menu id does not exist', async () => {
      mockPrismaService.role.findUnique.mockResolvedValueOnce(makeRole({ id: 'r' }));
      mockPrismaService.menu.findMany.mockResolvedValueOnce([{ id: 'm1' }]);

      await expect(service.assignMenus('r', { menuIds: ['m1', 'not-exist'] })).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
