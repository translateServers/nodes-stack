export const LogLevel = {
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
  Debug: 'debug',
  Verbose: 'verbose',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
