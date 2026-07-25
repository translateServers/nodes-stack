import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF 防护工具
 *
 * 设计依据：`docs/specs/dataset-management/security-decisions.md` §2.4
 *
 * 防护策略：
 * - 协议白名单：仅 http / https
 * - 内网 IP 拦截：RFC1918（10/8、172.16/12、192.168/16）、环回（127/8）、
 *   链路本地（169.254/16，含云元数据端点）、CGNAT（100.64/10）、IPv6 等价段
 * - 重定向限制：最多 3 次，每次跳转重新做目标校验
 * - 响应大小上限：默认 5MB
 */

/** 最大重定向次数 */
export const MAX_REDIRECTS = 3;

/** 默认响应大小上限（5MB） */
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/** 允许的协议 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * 判断 IP 地址是否为内网/保留地址
 *
 * 覆盖：
 * - IPv4: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0/8, 100.64/10
 * - IPv6: ::1（环回）, fe80::/10（链路本地）, fc00::/7（ULA）
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // 无法解析的 IP 视为不安全

  if (version === 4) {
    // IPv4 保留地址段
    return (
      /^10\./.test(ip) || // 10/8
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || // 172.16/12
      /^192\.168\./.test(ip) || // 192.168/16
      /^127\./.test(ip) || // loopback
      /^169\.254\./.test(ip) || // link-local（含云元数据 169.254.169.254）
      /^0\./.test(ip) || // 0/8
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) // 100.64/10 CGNAT
    );
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    // IPv4-mapped IPv6（::ffff:x.x.x.x）：提取内嵌 IPv4 递归检查，
    // 避免公网 IPv4 被映射后误判为内网
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice('::ffff:'.length);
      return isPrivateIp(v4);
    }
    return (
      lower === '::1' || // loopback
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fc') || // ULA fc00::/7
      lower.startsWith('fd') // ULA fc00::/7
    );
  }

  return false;
}

/**
 * IPv4-mapped IPv6 地址提取内嵌 IPv4 并检查
 *
 * 如 `::ffff:10.0.0.1` → 提取 `10.0.0.1` → isPrivateIp → true
 */
function checkMappedV4(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length);
    return isPrivateIp(v4);
  }
  return false;
}

/**
 * 校验目标 URL 的安全性
 *
 * 1. 协议白名单（http/https）
 * 2. 有 hostname
 * 3. DNS 解析后检查所有解析结果是否为内网 IP
 *
 * @throws Error 当协议非法、hostname 缺失或解析到内网 IP 时
 */
export async function validateTargetUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('无效的 URL 格式');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`不允许的协议：${parsed.protocol}（仅允许 http/https）`);
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('URL 缺少 hostname');
  }

  // 如果 hostname 本身是 IP 地址，直接检查
  if (isIP(hostname) !== 0) {
    if (isPrivateIp(hostname) || checkMappedV4(hostname)) {
      throw new Error(`目标 IP ${hostname} 属于内网/保留地址，已拦截`);
    }
    return parsed;
  }

  // DNS 解析 hostname
  let addresses: string[];
  try {
    const result = await lookup(hostname, { all: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw new Error(`DNS 解析失败：${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`DNS 解析无结果：${hostname}`);
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr) || checkMappedV4(addr)) {
      throw new Error(`目标域名 ${hostname} 解析到内网地址 ${addr}，已拦截`);
    }
  }

  return parsed;
}

/**
 * 检查重定向是否安全（每次跳转重新校验目标）
 *
 * @param redirectUrl Location header 值
 * @param redirectCount 当前已重定向次数
 * @throws Error 超过最大重定向次数或目标不安全
 */
export async function validateRedirect(redirectUrl: string, redirectCount: number): Promise<URL> {
  if (redirectCount >= MAX_REDIRECTS) {
    throw new Error(`超过最大重定向次数（${MAX_REDIRECTS}）`);
  }
  return validateTargetUrl(redirectUrl);
}
