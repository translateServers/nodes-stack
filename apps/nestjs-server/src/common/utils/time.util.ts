import dayjs from 'dayjs';

export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
} as const;

export type DateFormat = (typeof DATE_FORMATS)[keyof typeof DATE_FORMATS];

export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}

export function formatDate(
  date: Date | string | number,
  format: DateFormat = DATE_FORMATS.ISO,
): string {
  return dayjs(date).format(format);
}

export function formatToISO(date: Date | string | number): string {
  return formatDate(date, DATE_FORMATS.ISO);
}

export function formatToDatetime(date: Date | string | number): string {
  return formatDate(date, DATE_FORMATS.DATETIME);
}

export function formatToDate(date: Date | string | number): string {
  return formatDate(date, DATE_FORMATS.DATE);
}

export function parseDate(dateStr: string, format?: DateFormat): Date | null {
  const d = format ? dayjs(dateStr, format) : dayjs(dateStr);
  return d.isValid() ? d.toDate() : null;
}

export function getCurrentTime(): Date {
  return dayjs().toDate();
}

export function getCurrentTimeISO(): string {
  return formatToISO(getCurrentTime());
}

export function getCurrentTimeDatetime(): string {
  return formatToDatetime(getCurrentTime());
}

export function getCurrentTimeDate(): string {
  return formatToDate(getCurrentTime());
}
