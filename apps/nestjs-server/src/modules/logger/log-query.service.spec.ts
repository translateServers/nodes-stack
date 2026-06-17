import { LogQueryService, type LogEntry } from './log-query.service';
import { TypedConfigService } from '@/config/typed-config.service';

jest.mock('fs');
import * as fs from 'fs';

const mockFs = fs as jest.Mocked<typeof fs>;

const mockConfig = {
  get: jest.fn((path: string) => {
    if (path === 'logger.loggerDir') return '/tmp/logs';
    return undefined;
  }),
} as unknown as TypedConfigService;

describe('LogQueryService', () => {
  let service: LogQueryService;

  beforeEach(() => {
    service = new LogQueryService(mockConfig);
    jest.clearAllMocks();
  });

  describe('queryLogs', () => {
    it('should return empty array when log directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = service.queryLogs({});

      expect(result).toEqual([]);
    });

    it('should parse and return log entries', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app-2025-06-01.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [AppService] Application started\n' +
          '[2025-06-01 10:01:00.000] error [AuthService] Login failed\n',
      );

      const result = service.queryLogs({});

      expect(result).toHaveLength(2);
      expect(result[0].level).toBe('info');
      expect(result[0].module).toBe('AppService');
      expect(result[1].level).toBe('error');
    });

    it('should filter by level', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [App] OK\n' +
          '[2025-06-01 10:01:00.000] error [App] Fail\n',
      );

      const result = service.queryLogs({ level: 'error' });

      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('error');
    });

    it('should filter by keyword', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [App] User login\n' +
          '[2025-06-01 10:01:00.000] info [App] Cache hit\n',
      );

      const result = service.queryLogs({ keyword: 'login' });

      expect(result).toHaveLength(1);
      expect(result[0].message).toContain('login');
    });

    it('should respect the limit parameter', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      const lines = Array.from({ length: 20 }, (_, i) =>
        `[2025-06-01 10:00:${String(i).padStart(2, '0')}.000] info [App] Line ${i}`,
      ).join('\n');
      mockFs.readFileSync.mockReturnValue(lines);

      const result = service.queryLogs({ limit: 5 });

      expect(result).toHaveLength(5);
    });

    it('should skip unparseable lines', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        'this is not a valid log line\n' +
          '[2025-06-01 10:00:00.000] info [App] Valid line\n',
      );

      const result = service.queryLogs({});

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Valid line');
    });

    it('should filter by module name', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [AuthService] Login ok\n' +
          '[2025-06-01 10:01:00.000] info [AppService] Boot ok\n',
      );

      const result = service.queryLogs({ module: 'Auth' });

      expect(result).toHaveLength(1);
      expect(result[0].module).toBe('AuthService');
    });

    it('should filter by startDate', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [App] Old\n' +
          '[2025-06-02 10:00:00.000] info [App] New\n',
      );

      const result = service.queryLogs({ startDate: '2025-06-02' });

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('New');
    });

    it('should filter by endDate', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [App] Old\n' +
          '[2025-06-03 10:00:00.000] info [App] Future\n',
      );

      const result = service.queryLogs({ endDate: '2025-06-02' });

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Old');
    });

    it('should filter by combined startDate and endDate', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-05-31 10:00:00.000] info [App] Too early\n' +
          '[2025-06-02 10:00:00.000] info [App] In range\n' +
          '[2025-06-05 10:00:00.000] info [App] Too late\n',
      );

      const result = service.queryLogs({ startDate: '2025-06-01', endDate: '2025-06-03' });

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('In range');
    });
  });

  describe('getRecentLogs', () => {
    it('should delegate to queryLogs with default limit', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = service.getRecentLogs();

      expect(result).toEqual([]);
    });
  });

  describe('getErrorLogs', () => {
    it('should filter for error level logs', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['app.log'] as unknown as never[]);
      mockFs.readFileSync.mockReturnValue(
        '[2025-06-01 10:00:00.000] info [App] OK\n' +
          '[2025-06-01 10:01:00.000] error [App] Something broke\n',
      );

      const result = service.getErrorLogs();

      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('error');
    });
  });
});
