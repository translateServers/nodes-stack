import { lookup } from 'node:dns/promises';
import {
  isPrivateIp,
  validateTargetUrl,
  validateRedirect,
  MAX_REDIRECTS,
  DEFAULT_MAX_RESPONSE_BYTES,
} from '@/modules/dataset/utils/ssrf-guard';

// DNS lookup 被 ssrf-guard 内部调用，jest.mock 替换其行为
jest.mock('node:dns/promises');

describe('SSRF Guard', () => {
  const mockedLookup = jest.mocked(lookup);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPrivateIp', () => {
    it.each([
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '127.0.0.1',
      '127.255.255.255',
      '169.254.169.254', // 云元数据端点
      '169.254.0.1',
      '0.0.0.0',
      '100.64.0.1', // CGNAT
      '100.127.255.255',
      '::1', // IPv6 loopback
      'fe80::1', // IPv6 link-local
      'fc00::1', // IPv6 ULA
      'fd00::1', // IPv6 ULA
    ])('应识别 %s 为内网地址', (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });

    it.each([
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1', // 172.16/12 范围外
      '11.0.0.1',
      '100.128.0.1', // CGNAT 范围外
    ])('应识别 %s 为公网地址', (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    });

    it('无法解析的 IP 视为不安全', () => {
      expect(isPrivateIp('not-an-ip')).toBe(true);
    });

    it('IPv4-mapped IPv6 地址应检查内嵌 IPv4', () => {
      expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    });
  });

  describe('validateTargetUrl', () => {
    it('应拒绝非 http/https 协议', async () => {
      await expect(validateTargetUrl('file:///etc/passwd')).rejects.toThrow('不允许的协议');
      await expect(validateTargetUrl('ftp://example.com')).rejects.toThrow('不允许的协议');
    });

    it('应拒绝无效 URL', async () => {
      await expect(validateTargetUrl('not-a-url')).rejects.toThrow('无效的 URL');
    });

    it('hostname 为 IP 时直接检查', async () => {
      await expect(validateTargetUrl('http://10.0.0.1/api')).rejects.toThrow('内网/保留地址');
      await expect(validateTargetUrl('http://127.0.0.1/api')).rejects.toThrow('内网/保留地址');
    });

    it('公网 IP 应通过校验', async () => {
      const url = await validateTargetUrl('http://8.8.8.8/api');
      expect(url.hostname).toBe('8.8.8.8');
    });

    it('DNS 解析到内网 IP 应拦截', async () => {
      mockedLookup.mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }] as never);

      await expect(validateTargetUrl('http://example.com/api')).rejects.toThrow(
        '解析到内网地址 10.0.0.1',
      );
    });

    it('DNS 解析到公网 IP 应通过', async () => {
      mockedLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never);

      const url = await validateTargetUrl('http://example.com/api');
      expect(url.hostname).toBe('example.com');
    });

    it('DNS 解析失败应报错', async () => {
      mockedLookup.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(validateTargetUrl('http://nonexistent.invalid/api')).rejects.toThrow(
        'DNS 解析失败',
      );
    });
  });

  describe('validateRedirect', () => {
    it('超过最大重定向次数应拒绝', async () => {
      await expect(validateRedirect('http://example.com/redirect', MAX_REDIRECTS)).rejects.toThrow(
        '超过最大重定向次数',
      );
    });

    it('重定向到内网应拒绝', async () => {
      mockedLookup.mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }] as never);

      await expect(validateRedirect('http://internal.example.com', 0)).rejects.toThrow(
        '解析到内网地址',
      );
    });
  });

  it('DEFAULT_MAX_RESPONSE_BYTES 应为 5MB', () => {
    expect(DEFAULT_MAX_RESPONSE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('MAX_REDIRECTS 应为 3', () => {
    expect(MAX_REDIRECTS).toBe(3);
  });
});
