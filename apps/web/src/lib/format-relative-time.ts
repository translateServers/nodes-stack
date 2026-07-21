const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** 超过该天数后直接显示日期 */
const MAX_RELATIVE_DAYS = 30;

/**
 * 将 ISO 时间字符串格式化为相对时间。
 * 规则：刚刚 / N 分钟前 / N 小时前 / N 天前；超过 30 天显示 YYYY-MM-DD。
 */
export function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';

  const diff = Date.now() - time;

  // 未来时间或 1 分钟内视为"刚刚"
  if (diff < MINUTE_MS) return '刚刚';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} 分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} 小时前`;
  if (diff < MAX_RELATIVE_DAYS * DAY_MS) return `${Math.floor(diff / DAY_MS)} 天前`;

  // 超过 30 天显示具体日期（本地时区）
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
