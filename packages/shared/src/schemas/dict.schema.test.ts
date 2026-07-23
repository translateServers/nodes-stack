import { describe, it, expect } from 'vitest';
import { UpdateDictValueSchema } from './dict.schema.js';

describe('UpdateDictValueSchema', () => {
  it('should strip dictTypeId (omitted from schema)', () => {
    const result = UpdateDictValueSchema.parse({ dictTypeId: 't1', label: '新标签' });
    expect(result).not.toHaveProperty('dictTypeId');
    expect(result).toHaveProperty('label', '新标签');
  });
});
