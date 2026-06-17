import { Test, type TestingModule } from '@nestjs/testing';
import { DictService } from '@/modules/dict/dict.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateDictTypeDto,
  UpdateDictTypeDto,
  CreateDictValueDto,
  UpdateDictValueDto,
} from '@/modules/dict/dto/dict.dto';

interface DictTypeEntity {
  id: string;
  code: string;
  name: string;
  remark: string | null;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface DictValueEntity {
  id: string;
  dictTypeId: string;
  code: string;
  label: string;
  value: string;
  color: string | null;
  sort: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const mockPrismaService = {
  dictType: {
    create: jest.fn<Promise<DictTypeEntity>, [unknown]>(),
    findMany: jest.fn<Promise<DictTypeEntity[]>, []>(),
    findUnique: jest.fn<Promise<DictTypeEntity | null>, [unknown]>(),
    findFirst: jest.fn<Promise<DictTypeEntity | null>, [unknown]>(),
    update: jest.fn<Promise<DictTypeEntity>, [unknown]>(),
    delete: jest.fn<Promise<DictTypeEntity>, [unknown]>(),
  },
  dictValue: {
    create: jest.fn<Promise<DictValueEntity>, [unknown]>(),
    findMany: jest.fn<Promise<DictValueEntity[]>, [unknown]>(),
    findUnique: jest.fn<Promise<DictValueEntity | null>, [unknown]>(),
    findFirst: jest.fn<Promise<DictValueEntity | null>, [unknown]>(),
    update: jest.fn<Promise<DictValueEntity>, [unknown]>(),
    delete: jest.fn<Promise<DictValueEntity>, [unknown]>(),
  },
};

function makeDictType(overrides: Partial<DictTypeEntity> = {}): DictTypeEntity {
  const now = new Date('2025-06-01T10:00:00.000Z');
  return {
    id: overrides.id ?? 'type-id',
    code: overrides.code ?? 'user_status',
    name: overrides.name ?? '用户状态',
    remark: overrides.remark ?? null,
    isActive: overrides.isActive ?? true,
    sort: overrides.sort ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeDictValue(overrides: Partial<DictValueEntity> = {}): DictValueEntity {
  const now = new Date('2025-06-01T10:00:00.000Z');
  return {
    id: overrides.id ?? 'value-id',
    dictTypeId: overrides.dictTypeId ?? 'type-id',
    code: overrides.code ?? 'active',
    label: overrides.label ?? '启用',
    value: overrides.value ?? '1',
    color: overrides.color ?? null,
    remark: overrides.remark ?? null,
    isActive: overrides.isActive ?? true,
    sort: overrides.sort ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('DictService', () => {
  let service: DictService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DictService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<DictService>(DictService);
    jest.clearAllMocks();
  });

  describe('createType', () => {
    it('should create a dict type and return DictTypeResponse', async () => {
      const dto: CreateDictTypeDto = { code: 'user_status', name: '用户状态', remark: '测试备注' };
      mockPrismaService.dictType.findUnique.mockResolvedValue(null);
      mockPrismaService.dictType.create.mockResolvedValue(makeDictType(dto));

      const result = await service.createType(dto);

      expect(mockPrismaService.dictType.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.dictType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'user_status',
            name: '用户状态',
            remark: '测试备注',
          }) as object,
        }) as object,
      );
      expect(result.code).toBe('user_status');
      expect(typeof result.createdAt).toBe('string');
    });

    it('should throw BusinessException when dict type code already exists', async () => {
      const dto: CreateDictTypeDto = { code: 'existing_code', name: '已存在' };
      mockPrismaService.dictType.findUnique.mockResolvedValue(
        makeDictType({ code: 'existing_code' }),
      );

      await expect(service.createType(dto)).rejects.toThrow(BusinessException);
      expect(mockPrismaService.dictType.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllTypes', () => {
    it('should return all dict types', async () => {
      const types = [
        makeDictType({ id: '1', code: 'type1', name: '类型1' }),
        makeDictType({ id: '2', code: 'type2', name: '类型2' }),
      ];
      mockPrismaService.dictType.findMany.mockResolvedValue(types);

      const result = await service.findAllTypes();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('type1');
      expect(result[1].code).toBe('type2');
    });
  });

  describe('findTypeById', () => {
    it('should return dict type when found', async () => {
      const type = makeDictType({ id: 'test-id', code: 'test_code' });
      mockPrismaService.dictType.findUnique.mockResolvedValue(type);

      const result = await service.findTypeById('test-id');

      expect(result.id).toBe('test-id');
      expect(result.code).toBe('test_code');
    });

    it('should throw BusinessException when not found', async () => {
      mockPrismaService.dictType.findUnique.mockResolvedValue(null);

      await expect(service.findTypeById('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('updateType', () => {
    it('should update dict type', async () => {
      const dto: UpdateDictTypeDto = { name: '更新后的名称' };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'test-id' }));
      mockPrismaService.dictType.findFirst.mockResolvedValue(null);
      mockPrismaService.dictType.update.mockResolvedValue(
        makeDictType({ id: 'test-id', name: '更新后的名称' }),
      );

      const result = await service.updateType('test-id', dto);

      expect(result.name).toBe('更新后的名称');
    });

    it('should throw BusinessException when updating to duplicate code', async () => {
      const dto: UpdateDictTypeDto = { code: 'duplicate_code' };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'test-id' }));
      mockPrismaService.dictType.findFirst.mockResolvedValue(
        makeDictType({ id: 'other-id', code: 'duplicate_code' }),
      );

      await expect(service.updateType('test-id', dto)).rejects.toThrow(BusinessException);
    });

    it('should skip duplicate check when code is empty string', async () => {
      const dto: UpdateDictTypeDto = { code: '' };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'test-id' }));
      mockPrismaService.dictType.update.mockResolvedValue(makeDictType({ id: 'test-id', code: '' }));

      await service.updateType('test-id', dto);

      expect(mockPrismaService.dictType.findFirst).not.toHaveBeenCalled();
    });

    it('should update all fields when provided', async () => {
      const dto: UpdateDictTypeDto = {
        code: 'new_code',
        name: '新名称',
        remark: '新备注',
        isActive: false,
        sort: 10,
      };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'test-id' }));
      mockPrismaService.dictType.findFirst.mockResolvedValue(null);
      mockPrismaService.dictType.update.mockResolvedValue(
        makeDictType({ id: 'test-id', ...dto }),
      );

      const result = await service.updateType('test-id', dto);

      expect(mockPrismaService.dictType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-id' },
          data: expect.objectContaining({
            code: 'new_code',
            name: '新名称',
            remark: '新备注',
            isActive: false,
            sort: 10,
          }) as object,
        }) as object,
      );
    });
  });

  describe('removeType', () => {
    it('should delete dict type', async () => {
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'test-id' }));
      mockPrismaService.dictType.delete.mockResolvedValue(makeDictType({ id: 'test-id' }));

      await service.removeType('test-id');

      expect(mockPrismaService.dictType.delete).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });

    it('should throw BusinessException when type not found', async () => {
      mockPrismaService.dictType.findUnique.mockResolvedValue(null);

      await expect(service.removeType('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('createValue', () => {
    it('should create a dict value and return DictValueResponse', async () => {
      const dto: CreateDictValueDto = {
        dictTypeId: 'type-id',
        code: 'active',
        label: '启用',
        value: '1',
        color: '#10b981',
      };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'type-id' }));
      mockPrismaService.dictValue.findFirst.mockResolvedValue(null);
      mockPrismaService.dictValue.create.mockResolvedValue(makeDictValue(dto));

      const result = await service.createValue(dto);

      expect(mockPrismaService.dictValue.create).toHaveBeenCalledTimes(1);
      expect(result.code).toBe('active');
      expect(result.label).toBe('启用');
    });

    it('should throw BusinessException when dict type not found', async () => {
      const dto: CreateDictValueDto = {
        dictTypeId: 'non-existent',
        code: 'test',
        label: '测试',
        value: '1',
      };
      mockPrismaService.dictType.findUnique.mockResolvedValue(null);

      await expect(service.createValue(dto)).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException when dict value code already exists', async () => {
      const dto: CreateDictValueDto = {
        dictTypeId: 'type-id',
        code: 'existing',
        label: '已存在',
        value: '1',
      };
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'type-id' }));
      mockPrismaService.dictValue.findFirst.mockResolvedValue(makeDictValue({ code: 'existing' }));

      await expect(service.createValue(dto)).rejects.toThrow(BusinessException);
    });
  });

  describe('findValuesByTypeId', () => {
    it('should return all dict values for a type', async () => {
      const values = [
        makeDictValue({ id: '1', code: 'active', label: '启用' }),
        makeDictValue({ id: '2', code: 'inactive', label: '禁用' }),
      ];
      mockPrismaService.dictType.findUnique.mockResolvedValue(makeDictType({ id: 'type-id' }));
      mockPrismaService.dictValue.findMany.mockResolvedValue(values);

      const result = await service.findValuesByTypeId('type-id');

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('active');
      expect(result[1].code).toBe('inactive');
    });

    it('should throw BusinessException when dict type not found', async () => {
      mockPrismaService.dictType.findUnique.mockResolvedValue(null);

      await expect(service.findValuesByTypeId('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('updateValue', () => {
    it('should update dict value', async () => {
      const dto: UpdateDictValueDto = { label: '更新后的标签' };
      mockPrismaService.dictValue.findUnique.mockResolvedValue(makeDictValue({ id: 'value-id' }));
      mockPrismaService.dictValue.findFirst.mockResolvedValue(null);
      mockPrismaService.dictValue.update.mockResolvedValue(
        makeDictValue({ id: 'value-id', label: '更新后的标签' }),
      );

      const result = await service.updateValue('value-id', dto);

      expect(result.label).toBe('更新后的标签');
    });

    it('should throw BusinessException when value not found', async () => {
      mockPrismaService.dictValue.findUnique.mockResolvedValue(null);

      await expect(service.updateValue('non-existent', {})).rejects.toThrow(BusinessException);
    });

    it('should check for duplicate code when code is provided in update', async () => {
      const dto: UpdateDictValueDto = { code: 'dup_code' };
      mockPrismaService.dictValue.findUnique.mockResolvedValue(
        makeDictValue({ id: 'v1', dictTypeId: 't1' }),
      );
      mockPrismaService.dictValue.findFirst.mockResolvedValue(
        makeDictValue({ id: 'v2', code: 'dup_code' }),
      );

      await expect(service.updateValue('v1', dto)).rejects.toThrow(BusinessException);
    });

    it('should skip duplicate check when code is empty string', async () => {
      const dto: UpdateDictValueDto = { code: '' };
      mockPrismaService.dictValue.findUnique.mockResolvedValue(makeDictValue({ id: 'v1' }));
      mockPrismaService.dictValue.update.mockResolvedValue(makeDictValue({ id: 'v1', code: '' }));

      await service.updateValue('v1', dto);

      expect(mockPrismaService.dictValue.findFirst).not.toHaveBeenCalled();
    });

    it('should update all fields when all are provided', async () => {
      const dto: UpdateDictValueDto = {
        code: 'new_code',
        label: '新标签',
        value: '2',
        color: '#ff0000',
        remark: '备注',
        isActive: false,
        sort: 5,
      };
      mockPrismaService.dictValue.findUnique.mockResolvedValue(makeDictValue({ id: 'v1' }));
      mockPrismaService.dictValue.findFirst.mockResolvedValue(null);
      mockPrismaService.dictValue.update.mockResolvedValue(
        makeDictValue({ id: 'v1', ...dto }),
      );

      const result = await service.updateValue('v1', dto);

      expect(mockPrismaService.dictValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v1' },
          data: expect.objectContaining({
            code: 'new_code',
            label: '新标签',
            value: '2',
            color: '#ff0000',
            remark: '备注',
            isActive: false,
            sort: 5,
          }) as object,
        }) as object,
      );
    });
  });

  describe('removeValue', () => {
    it('should delete dict value', async () => {
      mockPrismaService.dictValue.findUnique.mockResolvedValue(makeDictValue({ id: 'value-id' }));
      mockPrismaService.dictValue.delete.mockResolvedValue(makeDictValue({ id: 'value-id' }));

      await service.removeValue('value-id');

      expect(mockPrismaService.dictValue.delete).toHaveBeenCalledWith({
        where: { id: 'value-id' },
      });
    });

    it('should throw BusinessException when value not found', async () => {
      mockPrismaService.dictValue.findUnique.mockResolvedValue(null);

      await expect(service.removeValue('non-existent')).rejects.toThrow(BusinessException);
    });
  });
});
