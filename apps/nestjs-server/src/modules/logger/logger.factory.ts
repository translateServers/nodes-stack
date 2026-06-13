import { TypedConfigService } from '@/config/typed-config.service';
import { sanitizeObject } from '@/common/utils/sanitize.util';
import dayjs from 'dayjs';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
} as const;

function createLogFormat(colorize: boolean) {
  return winston.format.combine(
    winston.format.ms(),
    colorize
      ? winston.format.colorize({
          colors: {
            error: 'red',
            warn: 'yellow',
            info: 'cyan',
            http: 'green',
            verbose: 'magenta',
            debug: 'blue',
            silly: 'gray',
            log: 'white',
          },
        })
      : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf((info) => {
      const { level, message, context, ms } = info;

      const rawTs =
        typeof info.timestamp === 'string' || typeof info.timestamp === 'number'
          ? info.timestamp
          : undefined;
      const ts = `${ANSI.gray}[${dayjs(rawTs).format('YYYY-MM-DD HH:mm:ss.SSS')}]${ANSI.reset}`;
      const levelStr = typeof level === 'string' ? level : '';
      const ctx = typeof context === 'string' ? ` ${ANSI.gray}[${context}]${ANSI.reset}` : '';
      const msg = typeof message === 'string' ? message : JSON.stringify(message);

      let duration = '';
      if (typeof ms === 'string') {
        const num = parseInt(ms, 10);
        if (!Number.isNaN(num)) {
          duration = ` ${ANSI.yellow}+${num}ms${ANSI.reset}`;
        }
      }

      const sanitizedMeta = sanitizeObject(info);
      const metaKeys = Object.keys(sanitizedMeta).filter(
        (k) =>
          ![
            'timestamp',
            'level',
            'message',
            'context',
            'ms',
            'Symbol(level)',
            'label',
            'splat',
          ].includes(k),
      );
      const metaStr =
        metaKeys.length > 0
          ? ` ${ANSI.dim}${JSON.stringify(
              metaKeys.reduce(
                (acc, k) => {
                  acc[k] = sanitizedMeta[k];
                  return acc;
                },
                {} as Record<string, unknown>,
              ),
            )}${ANSI.reset}`
          : '';

      return `${ts} ${levelStr}${ctx} ${msg}${duration}${metaStr}`;
    }),
  );
}

export function createLogger(config: TypedConfigService) {
  const isDevelopment = config.get('app.nodeEnv') === 'development';
  const logLevel = config.get('logger.loggerLevel');
  const enableFile = config.get('logger.loggerEnableFile');
  const logDir = config.get('logger.loggerDir');
  const maxFiles = config.get('logger.loggerMaxFiles');
  const maxSize = config.get('logger.loggerMaxSize');

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: createLogFormat(isDevelopment),
      level: logLevel,
    }),
  ];

  if (enableFile) {
    const combinedTransport = new DailyRotateFile({
      filename: `${logDir}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles,
      maxSize,
      format: createLogFormat(false),
      level: logLevel,
    });

    const errorTransport = new DailyRotateFile({
      filename: `${logDir}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles,
      maxSize,
      format: createLogFormat(false),
      level: 'error',
    });

    transports.push(combinedTransport, errorTransport);
  }

  return WinstonModule.createLogger({
    transports,
    exitOnError: false,
  });
}
