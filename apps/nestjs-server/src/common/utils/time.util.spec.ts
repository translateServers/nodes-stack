import {
  parseExpiresIn,
  formatDate,
  formatToISO,
  formatToDatetime,
  formatToDate,
  parseDate,
  getCurrentTime,
  getCurrentTimeISO,
  getCurrentTimeDatetime,
  getCurrentTimeDate,
  DATE_FORMATS,
} from './time.util';

describe('time.util', () => {
  describe('parseExpiresIn', () => {
    it('should parse seconds correctly', () => {
      expect(parseExpiresIn('60s')).toBe(60);
      expect(parseExpiresIn('3600s')).toBe(3600);
    });

    it('should parse minutes correctly', () => {
      expect(parseExpiresIn('5m')).toBe(300);
      expect(parseExpiresIn('60m')).toBe(3600);
    });

    it('should parse hours correctly', () => {
      expect(parseExpiresIn('1h')).toBe(3600);
      expect(parseExpiresIn('24h')).toBe(86400);
    });

    it('should parse days correctly', () => {
      expect(parseExpiresIn('1d')).toBe(86400);
      expect(parseExpiresIn('7d')).toBe(604800);
    });

    it('should return default value for invalid format', () => {
      expect(parseExpiresIn('invalid')).toBe(604800);
    });

    it('should return default value for empty string', () => {
      expect(parseExpiresIn('')).toBe(604800);
    });
  });

  describe('formatDate', () => {
    it('should format date with default ISO format', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = formatDate(date);

      expect(result).toContain('2024-01-01');
    });

    it('should format date with custom format', () => {
      const date = new Date('2024-01-01T20:30:45.000+08:00');
      const result = formatDate(date, DATE_FORMATS.DATETIME);

      expect(result).toContain('20:30:45');
    });

    it('should format date with DATE format', () => {
      const date = new Date('2024-01-01T12:30:45.000Z');
      const result = formatDate(date, DATE_FORMATS.DATE);

      expect(result).toContain('2024-01-01');
    });

    it('should format date string input', () => {
      const result = formatDate('2024-01-01', DATE_FORMATS.DATE);

      expect(result).toBe('2024-01-01');
    });
  });

  describe('formatToISO', () => {
    it('should format date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = formatToISO(date);

      expect(result).toContain('2024-01-01');
    });
  });

  describe('formatToDatetime', () => {
    it('should format date to datetime string', () => {
      const date = new Date('2024-01-01T20:30:45.000+08:00');
      const result = formatToDatetime(date);

      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatToDate', () => {
    it('should format date to date string', () => {
      const date = new Date('2024-01-01T12:30:45.000Z');
      const result = formatToDate(date);

      expect(result).toBe('2024-01-01');
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const result = parseDate('2024-01-01');

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should parse date with specific format', () => {
      const result = parseDate('2024-01-01 12:30:45', DATE_FORMATS.DATETIME);

      expect(result).toBeInstanceOf(Date);
    });

    it('should return null for invalid date string', () => {
      const result = parseDate('invalid-date');

      expect(result).toBeNull();
    });
  });

  describe('getCurrentTime', () => {
    it('should return current time as Date object', () => {
      const before = new Date();
      const result = getCurrentTime();
      const after = new Date();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getCurrentTimeISO', () => {
    it('should return current time in ISO format', () => {
      const result = getCurrentTimeISO();

      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('getCurrentTimeDatetime', () => {
    it('should return current time in datetime format', () => {
      const result = getCurrentTimeDatetime();

      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('getCurrentTimeDate', () => {
    it('should return current date in date format', () => {
      const result = getCurrentTimeDate();

      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });
});
