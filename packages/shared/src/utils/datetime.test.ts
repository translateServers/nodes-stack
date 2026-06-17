import { describe, it, expect } from 'vitest';
import { formatDateTime, parseDateTime } from './datetime.js';

describe('formatDateTime', () => {
  it('should format Date object to YYYY-MM-DD HH:mm:ss', () => {
    const date = new Date(2025, 5, 1, 10, 30, 45);
    expect(formatDateTime(date)).toBe('2025-06-01 10:30:45');
  });

  it('should format string input', () => {
    expect(formatDateTime('2025-01-15T08:05:03')).toBe('2025-01-15 08:05:03');
  });

  it('should pad single digit values', () => {
    const date = new Date(2025, 0, 5, 3, 7, 9);
    expect(formatDateTime(date)).toBe('2025-01-05 03:07:09');
  });
});

describe('parseDateTime', () => {
  it('should parse YYYY-MM-DD HH:mm:ss format', () => {
    const result = parseDateTime('2025-06-01 10:30:45');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
  });

  it('should handle midnight', () => {
    const result = parseDateTime('2025-01-01 00:00:00');
    expect(result.getFullYear()).toBe(2025);
  });
});
