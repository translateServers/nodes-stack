import { describe, it, expect } from 'vitest';
import { DateTimeStringSchema, DATETIME_REGEX } from './datetime.schema.js';

describe('DateTimeStringSchema', () => {
  it('should accept valid datetime string', () => {
    expect(DateTimeStringSchema.parse('2025-06-01 10:30:45')).toBe('2025-06-01 10:30:45');
  });

  it('should reject invalid format', () => {
    expect(() => DateTimeStringSchema.parse('2025/06/01 10:30:45')).toThrow();
  });

  it('should reject date only', () => {
    expect(() => DateTimeStringSchema.parse('2025-06-01')).toThrow();
  });

  it('should reject ISO format', () => {
    expect(() => DateTimeStringSchema.parse('2025-06-01T10:30:45')).toThrow();
  });

  it('should reject empty string', () => {
    expect(() => DateTimeStringSchema.parse('')).toThrow();
  });

  it('DATETIME_REGEX should match expected format', () => {
    expect(DATETIME_REGEX.test('2025-01-01 00:00:00')).toBe(true);
    expect(DATETIME_REGEX.test('9999-12-31 23:59:59')).toBe(true);
    expect(DATETIME_REGEX.test('not-a-date')).toBe(false);
  });
});
