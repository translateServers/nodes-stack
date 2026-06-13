/**
 * 日期时间格式化工具
 * 约定格式：YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 解析日期时间字符串
 */
export function parseDateTime(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}
