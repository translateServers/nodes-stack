import { TypedConfigService } from '@/config/typed-config.service';
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface LogQuery {
  level?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  module?: string;
  limit?: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  module?: string;
  message: string;
  raw: string;
}

@Injectable()
export class LogQueryService {
  private readonly logDir: string;

  constructor(config: TypedConfigService) {
    this.logDir = config.get('logger.loggerDir');
  }

  queryLogs(query: LogQuery): LogEntry[] {
    const { level, keyword, startDate, endDate, module, limit = 100 } = query;

    const logFiles = this.getLogFiles();

    const entries: LogEntry[] = [];

    for (const file of logFiles.slice(0, 10)) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const entry = this.parseLine(line);
        if (!entry) {
          continue;
        }

        if (level && !entry.level.toLowerCase().includes(level.toLowerCase())) {
          continue;
        }

        if (keyword && !entry.raw.toLowerCase().includes(keyword.toLowerCase())) {
          continue;
        }

        if (module && entry.module && !entry.module.toLowerCase().includes(module.toLowerCase())) {
          continue;
        }

        if (startDate || endDate) {
          const entryDate = new Date(entry.timestamp);
          if (startDate && entryDate < new Date(startDate)) {
            continue;
          }
          if (endDate && entryDate > new Date(endDate)) {
            continue;
          }
        }

        entries.push(entry);

        if (entries.length >= limit) {
          return entries;
        }
      }
    }

    return entries;
  }

  private getLogFiles(): string[] {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }

    return fs
      .readdirSync(this.logDir)
      .filter((file) => file.endsWith('.log') && !file.startsWith('error'))
      .map((file) => path.join(this.logDir, file))
      .sort()
      .reverse();
  }

  private parseLine(line: string): LogEntry | null {
    const match = line.match(/^\[(.+?)\]\s+(\w+)\s+(?:\[(.+?)\])?\s+(.+)/);

    if (!match) {
      return null;
    }

    return {
      timestamp: match[1],
      level: match[2],
      module: match[3] || undefined,
      message: match[4],
      raw: line,
    };
  }

  getRecentLogs(limit = 50): LogEntry[] {
    return this.queryLogs({ limit });
  }

  getErrorLogs(limit = 50): LogEntry[] {
    return this.queryLogs({ level: 'error', limit });
  }
}
