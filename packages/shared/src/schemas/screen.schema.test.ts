import { describe, it, expect } from 'vitest';
import { PublishScreenProjectSchema, UpdateScreenProjectSchema } from './screen.schema.js';

describe('UpdateScreenProjectSchema', () => {
  it('should accept valid expectedUpdatedAt', () => {
    const data = { expectedUpdatedAt: '2025-06-01 10:30:45' };
    expect(UpdateScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should accept valid expectedUpdatedAt together with optional fields', () => {
    const data = {
      name: 'screen-1',
      expectedUpdatedAt: '2025-06-01 10:30:45',
    };
    expect(UpdateScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should reject missing expectedUpdatedAt', () => {
    expect(() => UpdateScreenProjectSchema.parse({})).toThrow();
  });

  it('should reject invalid datetime string (ISO format)', () => {
    expect(() =>
      UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '2025-06-01T10:30:45Z' }),
    ).toThrow();
  });

  it('should reject invalid datetime string (slash format)', () => {
    expect(() =>
      UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '2025/06/01 10:30:45' }),
    ).toThrow();
  });

  it('should reject empty datetime string', () => {
    expect(() => UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '' })).toThrow();
  });
});

describe('PublishScreenProjectSchema', () => {
  it('should reject missing expectedUpdatedAt', () => {
    expect(() => PublishScreenProjectSchema.parse({})).toThrow();
  });

  it('should reject invalid datetime string (ISO format)', () => {
    expect(() =>
      PublishScreenProjectSchema.parse({ expectedUpdatedAt: '2025-06-01T10:30:45Z' }),
    ).toThrow();
  });

  it('should reject invalid datetime string (slash format)', () => {
    expect(() =>
      PublishScreenProjectSchema.parse({ expectedUpdatedAt: '2025/06/01 10:30:45' }),
    ).toThrow();
  });

  it('should accept valid datetime string', () => {
    const data = { expectedUpdatedAt: '2025-06-01 10:30:45' };
    expect(PublishScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should strip extra fields (canvas) by default (zod non-strict)', () => {
    const data = {
      expectedUpdatedAt: '2025-06-01 10:30:45',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
    };
    expect(PublishScreenProjectSchema.parse(data)).toEqual({
      expectedUpdatedAt: '2025-06-01 10:30:45',
    });
  });

  it('should not accept canvas/components fields as recognized keys', () => {
    const data = {
      expectedUpdatedAt: '2025-06-01 10:30:45',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
      components: [],
    };
    const parsed = PublishScreenProjectSchema.parse(data);
    expect(parsed).not.toHaveProperty('canvas');
    expect(parsed).not.toHaveProperty('components');
  });
});
