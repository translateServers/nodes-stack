import { describe, it, expect } from 'vitest';
import { PaginationQuerySchema, PaginatedResponseSchema } from './paginated.schema.js';

describe('PaginationQuerySchema', () => {
  it('should accept valid query', () => {
    expect(PaginationQuerySchema.parse({ page: 2, pageSize: 20 })).toEqual({
      page: 2,
      pageSize: 20,
    });
  });

  it('should apply defaults when empty', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('should reject page < 1', () => {
    expect(() => PaginationQuerySchema.parse({ page: 0 })).toThrow();
  });

  it('should reject pageSize > 100', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('should reject pageSize < 1', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 0 })).toThrow();
  });

  it('should reject non-integer page', () => {
    expect(() => PaginationQuerySchema.parse({ page: 1.5 })).toThrow();
  });
});

describe('PaginatedResponseSchema', () => {
  it('should accept valid response', () => {
    const data = { total: 100, page: 1, pageSize: 10, totalPages: 10 };
    expect(PaginatedResponseSchema.parse(data)).toEqual(data);
  });

  it('should reject missing fields', () => {
    expect(() => PaginatedResponseSchema.parse({ total: 1 })).toThrow();
  });
});
