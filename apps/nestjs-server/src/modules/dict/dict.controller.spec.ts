import { Test, type TestingModule } from '@nestjs/testing';
import { DictController } from '@/modules/dict/dict.controller';
import { DictService } from '@/modules/dict/dict.service';
import type {
  CreateDictTypeDto,
  UpdateDictTypeDto,
  CreateDictValueDto,
  UpdateDictValueDto,
} from '@/modules/dict/dto/dict.dto';

interface MockDictService {
  createType: jest.Mock;
  findAllTypes: jest.Mock;
  findTypeById: jest.Mock;
  updateType: jest.Mock;
  removeType: jest.Mock;
  createValue: jest.Mock;
  findValuesByTypeId: jest.Mock;
  updateValue: jest.Mock;
  removeValue: jest.Mock;
}

const mockDictService: MockDictService = {
  createType: jest.fn(),
  findAllTypes: jest.fn(),
  findTypeById: jest.fn(),
  updateType: jest.fn(),
  removeType: jest.fn(),
  createValue: jest.fn(),
  findValuesByTypeId: jest.fn(),
  updateValue: jest.fn(),
  removeValue: jest.fn(),
};

describe('DictController', () => {
  let controller: DictController;
  let service: MockDictService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DictController],
      providers: [{ provide: DictService, useValue: mockDictService }],
    }).compile();

    controller = module.get<DictController>(DictController);
    service = module.get<MockDictService>(DictService);
    jest.clearAllMocks();
  });

  describe('createType', () => {
    it('should call service.createType with dto', async () => {
      const dto: CreateDictTypeDto = { code: 'test_code', name: '测试类型', remark: '测试备注' };
      const expected = {
        id: 'type-id',
        ...dto,
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.createType.mockResolvedValue(expected);

      const result = await controller.createType(dto);

      expect(service.createType).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAllTypes', () => {
    it('should call service.findAllTypes', async () => {
      const expected = [
        {
          id: '1',
          code: 'code1',
          name: '类型1',
          isActive: true,
          sort: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          code: 'code2',
          name: '类型2',
          isActive: true,
          sort: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      service.findAllTypes.mockResolvedValue(expected);

      const result = await controller.findAllTypes();

      expect(service.findAllTypes).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('findTypeById', () => {
    it('should call service.findTypeById with id', async () => {
      const expected = {
        id: 'type-id',
        code: 'test_code',
        name: '测试类型',
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.findTypeById.mockResolvedValue(expected);

      const result = await controller.findTypeById('type-id');

      expect(service.findTypeById).toHaveBeenCalledWith('type-id');
      expect(result).toEqual(expected);
    });
  });

  describe('updateType', () => {
    it('should call service.updateType with id and dto', async () => {
      const dto: UpdateDictTypeDto = { name: '更新后的名称' };
      const expected = {
        id: 'type-id',
        code: 'test_code',
        name: '更新后的名称',
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.updateType.mockResolvedValue(expected);

      const result = await controller.updateType('type-id', dto);

      expect(service.updateType).toHaveBeenCalledWith('type-id', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('removeType', () => {
    it('should call service.removeType with id', async () => {
      service.removeType.mockResolvedValue(undefined);

      await controller.removeType('type-id');

      expect(service.removeType).toHaveBeenCalledWith('type-id');
    });
  });

  describe('createValue', () => {
    it('should call service.createValue with dto', async () => {
      const dto: CreateDictValueDto = {
        dictTypeId: 'type-id',
        code: 'test_value',
        label: '测试值',
        value: '1',
        color: '#ff0000',
      };
      const expected = {
        id: 'value-id',
        ...dto,
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.createValue.mockResolvedValue(expected);

      const result = await controller.createValue(dto);

      expect(service.createValue).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findValuesByTypeId', () => {
    it('should call service.findValuesByTypeId with id', async () => {
      const expected = [
        {
          id: '1',
          dictTypeId: 'type-id',
          code: 'value1',
          label: '值1',
          value: '1',
          isActive: true,
          sort: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          dictTypeId: 'type-id',
          code: 'value2',
          label: '值2',
          value: '2',
          isActive: true,
          sort: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      service.findValuesByTypeId.mockResolvedValue(expected);

      const result = await controller.findValuesByTypeId('type-id');

      expect(service.findValuesByTypeId).toHaveBeenCalledWith('type-id');
      expect(result).toEqual(expected);
    });
  });

  describe('updateValue', () => {
    it('should call service.updateValue with id and dto', async () => {
      const dto: UpdateDictValueDto = { label: '更新后的标签' };
      const expected = {
        id: 'value-id',
        dictTypeId: 'type-id',
        code: 'test_value',
        label: '更新后的标签',
        value: '1',
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.updateValue.mockResolvedValue(expected);

      const result = await controller.updateValue('value-id', dto);

      expect(service.updateValue).toHaveBeenCalledWith('value-id', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('removeValue', () => {
    it('should call service.removeValue with id', async () => {
      service.removeValue.mockResolvedValue(undefined);

      await controller.removeValue('value-id');

      expect(service.removeValue).toHaveBeenCalledWith('value-id');
    });
  });
});
