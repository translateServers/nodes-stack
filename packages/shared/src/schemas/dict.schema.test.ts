import { describe, it, expect } from 'vitest';
import {
  CreateDictTypeSchema,
  UpdateDictTypeSchema,
  CreateDictValueSchema,
  UpdateDictValueSchema,
  DictTypeSchema,
  DictValueSchema,
  DictTypeWithValuesSchema,
} from './dict.schema.js';

describe('CreateDictTypeSchema', () => {
  const valid = { code: 'user_status', name: '用户状态' };

  it('should accept valid input', () => {
    expect(CreateDictTypeSchema.parse(valid)).toEqual(valid);
  });

  it('should accept all optional fields', () => {
    const full = { ...valid, remark: '备注', isActive: true, sort: 5 };
    expect(CreateDictTypeSchema.parse(full)).toEqual(full);
  });

  it('should reject empty code', () => {
    expect(() => CreateDictTypeSchema.parse({ code: '', name: 'test' })).toThrow();
  });

  it('should reject empty name', () => {
    expect(() => CreateDictTypeSchema.parse({ code: 'test', name: '' })).toThrow();
  });

  it('should reject negative sort', () => {
    expect(() => CreateDictTypeSchema.parse({ ...valid, sort: -1 })).toThrow();
  });
});

describe('UpdateDictTypeSchema', () => {
  it('should accept empty object', () => {
    expect(UpdateDictTypeSchema.parse({})).toEqual({});
  });

  it('should accept partial fields', () => {
    expect(UpdateDictTypeSchema.parse({ name: '新名称' })).toEqual({ name: '新名称' });
  });
});

describe('CreateDictValueSchema', () => {
  const valid = {
    dictTypeId: 'type-1',
    code: 'active',
    label: '启用',
    value: '1',
  };

  it('should accept valid input', () => {
    expect(CreateDictValueSchema.parse(valid)).toEqual(valid);
  });

  it('should accept optional fields', () => {
    const full = { ...valid, color: '#10b981', sort: 1, isActive: false, remark: '备注' };
    expect(CreateDictValueSchema.parse(full)).toEqual(full);
  });

  it('should reject empty code', () => {
    expect(() => CreateDictValueSchema.parse({ ...valid, code: '' })).toThrow();
  });

  it('should reject empty label', () => {
    expect(() => CreateDictValueSchema.parse({ ...valid, label: '' })).toThrow();
  });

  it('should reject empty value', () => {
    expect(() => CreateDictValueSchema.parse({ ...valid, value: '' })).toThrow();
  });

  it('should reject empty dictTypeId', () => {
    expect(() => CreateDictValueSchema.parse({ ...valid, dictTypeId: '' })).toThrow();
  });

  it('should reject negative sort', () => {
    expect(() => CreateDictValueSchema.parse({ ...valid, sort: -1 })).toThrow();
  });
});

describe('UpdateDictValueSchema', () => {
  it('should accept empty object', () => {
    expect(UpdateDictValueSchema.parse({})).toEqual({});
  });

  it('should strip dictTypeId (omitted from schema)', () => {
    const result = UpdateDictValueSchema.parse({ dictTypeId: 't1', label: '新标签' });
    expect(result).not.toHaveProperty('dictTypeId');
    expect(result).toHaveProperty('label', '新标签');
  });

  it('should accept valid partial update', () => {
    expect(UpdateDictValueSchema.parse({ label: '新标签', value: '2' })).toEqual({
      label: '新标签',
      value: '2',
    });
  });
});

describe('DictTypeSchema', () => {
  const valid = {
    id: 't1',
    code: 'user_status',
    name: '用户状态',
    sort: 0,
    remark: null,
    isActive: true,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };

  it('should accept valid dict type', () => {
    expect(DictTypeSchema.parse(valid)).toEqual(valid);
  });

  it('should reject invalid datetime', () => {
    expect(() => DictTypeSchema.parse({ ...valid, createdAt: 'bad' })).toThrow();
  });
});

describe('DictValueSchema', () => {
  const valid = {
    id: 'v1',
    dictTypeId: 't1',
    code: 'active',
    label: '启用',
    value: '1',
    color: null,
    sort: 0,
    remark: null,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
    isActive: true,
  };

  it('should accept valid dict value', () => {
    expect(DictValueSchema.parse(valid)).toEqual(valid);
  });
});

describe('DictTypeWithValuesSchema', () => {
  it('should accept dict type with values array', () => {
    const data = {
      id: 't1',
      code: 'user_status',
      name: '用户状态',
      sort: 0,
      isActive: true,
      createdAt: '2025-06-01 10:00:00',
      updatedAt: '2025-06-01 10:00:00',
      values: [
        {
          id: 'v1',
          dictTypeId: 't1',
          code: 'active',
          label: '启用',
          value: '1',
          color: null,
          sort: 0,
          remark: null,
          createdAt: '2025-06-01 10:00:00',
          updatedAt: '2025-06-01 10:00:00',
          isActive: true,
        },
      ],
    };
    expect(DictTypeWithValuesSchema.parse(data).values).toHaveLength(1);
  });

  it('should accept empty values array', () => {
    const data = {
      id: 't1',
      code: 'test',
      name: 'Test',
      sort: 0,
      isActive: true,
      createdAt: '2025-06-01 10:00:00',
      updatedAt: '2025-06-01 10:00:00',
      values: [],
    };
    expect(DictTypeWithValuesSchema.parse(data).values).toEqual([]);
  });
});
