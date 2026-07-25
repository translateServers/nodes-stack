import { ApiExecutor } from '@/modules/dataset/executors/api.executor';
import { BizCode } from '@/common/enums/biz-code.enum';

// mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// mock dns lookup（ssrf-guard 内部使用）
jest.mock('node:dns/promises');
import { lookup } from 'node:dns/promises';
const mockedLookup = jest.mocked(lookup);

describe('ApiExecutor', () => {
  let executor: ApiExecutor;

  beforeEach(() => {
    executor = new ApiExecutor();
    jest.clearAllMocks();
    // 默认 DNS 解析返回公网 IP
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
  });

  function makeJsonResponse(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ): Response {
    const jsonStr = JSON.stringify(body);
    const encoded = new TextEncoder().encode(jsonStr);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
    return new Response(stream, {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  }

  describe('execute - 基本 HTTP 请求', () => {
    it('GET 请求应返回 JSON 响应', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ data: { list: [1, 2, 3] } }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/data',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      const result = await executor.execute(config, {});
      expect(result).toEqual({ data: { list: [1, 2, 3] } });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('POST 请求应发送 JSON body', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/create',
        method: 'POST' as const,
        contentType: 'json' as const,
        body: { name: '{{name}}' },
      };

      const result = await executor.execute(config, { name: 'test' });
      expect(result).toEqual({ success: true });

      const [, init] = mockFetch.mock.calls[0];
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ name: 'test' }));
    });

    it('应正确处理非 JSON 响应', async () => {
      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('plain text'));
          controller.close();
        },
      });
      mockFetch.mockResolvedValueOnce(new Response(textStream, { status: 200 }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/text',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      const result = await executor.execute(config, {});
      expect(result).toBe('plain text');
    });
  });

  describe('execute - SSRF 防护', () => {
    it('应拒绝内网 IP 目标', async () => {
      const config = {
        type: 'api' as const,
        path: 'http://10.0.0.1/internal',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toThrow('内网/保留地址');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('应拒绝非 http/https 协议', async () => {
      const config = {
        type: 'api' as const,
        path: 'file:///etc/passwd',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toThrow('不允许的协议');
    });

    it('DNS 解析到内网 IP 应拦截', async () => {
      mockedLookup.mockResolvedValueOnce([{ address: '192.168.1.1', family: 4 }] as never);

      const config = {
        type: 'api' as const,
        path: 'https://internal.example.com/api',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toThrow('解析到内网地址');
    });
  });

  describe('execute - 错误处理', () => {
    it('非 2xx 响应应抛出 DATASET_EXECUTION_FAILED', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ error: 'not found' }, 404));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/notfound',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toMatchObject({
        bizCode: BizCode.DATASET_EXECUTION_FAILED,
      });
    });

    it('重定向缺少 Location 头应报错', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: {} }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/redirect',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toMatchObject({
        bizCode: BizCode.DATASET_EXECUTION_FAILED,
      });
    });

    it('重定向到内网应拦截', async () => {
      // 第一次请求返回 302 重定向
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'http://10.0.0.1/internal' },
        }),
      );

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/redirect',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      await expect(executor.execute(config, {})).rejects.toThrow('内网/保留地址');
    });
  });

  describe('execute - 参数插值', () => {
    it('应替换 body 中的 {{param}} 占位符', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/search',
        method: 'POST' as const,
        contentType: 'json' as const,
        body: { query: '{{keyword}}', page: 1 },
      };

      await executor.execute(config, { keyword: 'test' });

      const [, init] = mockFetch.mock.calls[0];
      expect(init?.body).toBe(JSON.stringify({ query: 'test', page: 1 }));
    });

    it('未匹配的占位符应保留原样', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/search',
        method: 'POST' as const,
        contentType: 'json' as const,
        body: { query: '{{missing}}' },
      };

      await executor.execute(config, {});
      const [, init] = mockFetch.mock.calls[0];
      expect(init?.body).toBe(JSON.stringify({ query: '{{missing}}' }));
    });
  });

  describe('test', () => {
    it('应返回 raw + parsed + meta', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ data: 'test' }));

      const config = {
        type: 'api' as const,
        path: 'https://api.example.com/data',
        method: 'GET' as const,
        contentType: 'json' as const,
      };

      const result = await executor.test(config, {});
      expect(result.raw).toEqual({ data: 'test' });
      expect(result.parsed).toEqual({ data: 'test' });
      expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
