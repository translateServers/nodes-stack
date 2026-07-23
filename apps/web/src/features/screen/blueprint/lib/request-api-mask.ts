/**
 * requestApi 脱敏工具（任务 10.4）
 *
 * 纯函数：将 headers / url / body 中标记为 secret 的字段值替换为 ***，
 * 用于日志输出与诊断展示。
 *
 * 脱敏规则：
 * - header 键名（不区分大小写）命中 secretHeaderKeys 时，值替换为 '***'
 * - URL query 参数键命中时，值替换为 '***'（仅日志展示，不影响真实请求）
 * - body 中 JSON 字段命中时递归替换（仅当 body 为合法 JSON 时）
 *
 * 不修改输入，返回新对象。
 */

/** 默认脱敏占位符 */
export const SECRET_MASK = '***';

/** 大小写不敏感的 Set 包装 */
function makeCaseInsensitiveSet(keys: readonly string[]): Set<string> {
  return new Set(keys.map((k) => k.toLowerCase()));
}

/**
 * 对 headers 执行脱敏。
 *
 * @param headers 原始 headers
 * @param secretHeaderKeys 需要脱敏的 header 键名（大小写不敏感）
 * @returns 新 headers 对象，命中键的值替换为 ***
 */
export function maskHeaders(
  headers: Record<string, string>,
  secretHeaderKeys: readonly string[],
): Record<string, string> {
  const secretSet = makeCaseInsensitiveSet(secretHeaderKeys);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = secretSet.has(key.toLowerCase()) ? SECRET_MASK : value;
  }
  return result;
}

/**
 * 对 URL 执行 query 参数脱敏。
 *
 * @param url 原始 URL
 * @param secretKeys 需要脱敏的参数键名（大小写不敏感）
 * @returns 脱敏后的 URL 字符串
 */
export function maskUrlQuery(url: string, secretKeys: readonly string[]): string {
  if (secretKeys.length === 0) return url;
  // 拆分 hash 与 query
  const hashIndex = url.indexOf('#');
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = urlWithoutHash.indexOf('?');
  if (queryIndex < 0) return url;

  const base = urlWithoutHash.slice(0, queryIndex);
  const query = urlWithoutHash.slice(queryIndex + 1);
  const secretSet = makeCaseInsensitiveSet(secretKeys);
  const pairs = query.split('&');
  const maskedPairs = pairs.map((pair) => {
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 0) return pair;
    const key = pair.slice(0, eqIndex);
    if (secretSet.has(key.toLowerCase())) {
      return `${key}=${SECRET_MASK}`;
    }
    return pair;
  });
  return `${base}?${maskedPairs.join('&')}${hashPart}`;
}

/**
 * 对 JSON body 执行脱敏。
 *
 * 若 body 不是合法 JSON，原样返回。
 *
 * @param body 原始 body 字符串
 * @param secretKeys 需要脱敏的字段键名（大小写不敏感）
 * @returns 脱敏后的 body 字符串
 */
export function maskJsonBody(body: string, secretKeys: readonly string[]): string {
  if (secretKeys.length === 0 || body === '') return body;
  try {
    const parsed: unknown = JSON.parse(body);
    const secretSet = makeCaseInsensitiveSet(secretKeys);
    const masked = maskJsonValue(parsed, secretSet);
    return JSON.stringify(masked);
  } catch {
    // 非 JSON 或解析失败：原样返回
    return body;
  }
}

/** 递归脱敏 JSON 值 */
function maskJsonValue(value: unknown, secretSet: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => maskJsonValue(v, secretSet));
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      result[key] = secretSet.has(key.toLowerCase()) ? SECRET_MASK : maskJsonValue(v, secretSet);
    }
    return result;
  }
  return value;
}

/**
 * 对完整请求参数执行脱敏（headers + url + body 一并处理）。
 *
 * 用于执行器日志输出前的预处理。
 */
export function maskRequestForLog(params: {
  url: string;
  headers: Record<string, string>;
  body: string;
  secretHeaderKeys: readonly string[];
}): {
  url: string;
  headers: Record<string, string>;
  body: string;
} {
  return {
    url: maskUrlQuery(params.url, params.secretHeaderKeys),
    headers: maskHeaders(params.headers, params.secretHeaderKeys),
    body: maskJsonBody(params.body, params.secretHeaderKeys),
  };
}
