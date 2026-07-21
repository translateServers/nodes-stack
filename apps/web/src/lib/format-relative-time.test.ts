import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './format-relative-time';

// 固定当前时间，保证相对时间断言稳定
const NOW = new Date('2026-07-21T12:00:00.000Z');

function isoBefore(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 刚刚 for time within 1 minute', () => {
    expect(formatRelativeTime(isoBefore(30 * 1000))).toBe('刚刚');
  });

  it('should return 刚刚 for future time', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 60 * 1000).toISOString())).toBe('刚刚');
  });

  it('should return minutes ago', () => {
    expect(formatRelativeTime(isoBefore(5 * 60 * 1000))).toBe('5 分钟前');
    expect(formatRelativeTime(isoBefore(59 * 60 * 1000))).toBe('59 分钟前');
  });

  it('should return hours ago', () => {
    expect(formatRelativeTime(isoBefore(3 * 60 * 60 * 1000))).toBe('3 小时前');
    expect(formatRelativeTime(isoBefore(23 * 60 * 60 * 1000))).toBe('23 小时前');
  });

  it('should return days ago', () => {
    expect(formatRelativeTime(isoBefore(2 * 24 * 60 * 60 * 1000))).toBe('2 天前');
    expect(formatRelativeTime(isoBefore(29 * 24 * 60 * 60 * 1000))).toBe('29 天前');
  });

  it('should return formatted date when older than 30 days', () => {
    const iso = isoBefore(31 * 24 * 60 * 60 * 1000);
    const date = new Date(iso);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    expect(formatRelativeTime(iso)).toBe(expected);
    expect(formatRelativeTime(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return empty string for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
