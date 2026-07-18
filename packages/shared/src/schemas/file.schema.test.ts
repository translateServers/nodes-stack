import { describe, it, expect } from 'vitest';
import { FileSchema, FileListSchema } from './file.schema.js';

describe('FileSchema', () => {
  const valid = {
    id: 'file-id-1',
    rowId: 'row-id-1',
    fileName: 'report.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };

  it('应接受完整且合法的文件对象', () => {
    expect(FileSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['id', 'id'],
    ['rowId', 'rowId'],
    ['fileName', 'fileName'],
    ['fileSize', 'fileSize'],
    ['mimeType', 'mimeType'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
  ] as const)('缺少 %s 字段时拒绝', (_label, key) => {
    const { [key]: _removed, ...rest } = valid;
    expect(() => FileSchema.parse(rest)).toThrow();
  });

  it('id 为非字符串时拒绝', () => {
    expect(() => FileSchema.parse({ ...valid, id: 123 })).toThrow();
  });

  it('fileSize 为非数字时拒绝', () => {
    expect(() => FileSchema.parse({ ...valid, fileSize: '1024' })).toThrow();
  });

  it('fileName 为空字符串仍接受（schema 未约束最小长度）', () => {
    expect(FileSchema.parse({ ...valid, fileName: '' }).fileName).toBe('');
  });

  it('fileSize 为 0 仍接受', () => {
    expect(FileSchema.parse({ ...valid, fileSize: 0 }).fileSize).toBe(0);
  });

  it('fileSize 为负数仍接受（schema 未约束范围，由业务层校验）', () => {
    expect(FileSchema.parse({ ...valid, fileSize: -1 }).fileSize).toBe(-1);
  });

  it('剥离未知字段（zod 默认 strip）', () => {
    const result = FileSchema.parse({ ...valid, extra: 'unknown', userId: 'u-1' });
    expect(result).toEqual(valid);
    expect(result).not.toHaveProperty('extra');
    expect(result).not.toHaveProperty('userId');
  });
});

describe('FileListSchema', () => {
  const validFile = {
    id: 'file-1',
    rowId: 'row-1',
    fileName: 'a.pdf',
    fileSize: 100,
    mimeType: 'application/pdf',
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };

  it('接受空数组', () => {
    expect(FileListSchema.parse([])).toEqual([]);
  });

  it('接受合法文件数组', () => {
    const files = [
      validFile,
      { ...validFile, id: 'file-2', fileName: 'b.png', mimeType: 'image/png' },
    ];
    expect(FileListSchema.parse(files)).toEqual(files);
  });

  it.each([
    ['对象', { id: '1' }],
    ['字符串', 'not-an-array'],
    ['null', null],
    ['数字', 0],
  ])('非数组输入（%s）拒绝', (_label, input) => {
    expect(() => FileListSchema.parse(input)).toThrow();
  });

  it('数组中包含不合法元素时拒绝', () => {
    expect(() => FileListSchema.parse([{ id: 'only-id' }])).toThrow();
  });
});
