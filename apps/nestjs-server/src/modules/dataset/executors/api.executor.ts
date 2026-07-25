import { Injectable } from '@nestjs/common';
import type { ApiDatasetConfig } from '@nebula/shared/schemas';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { DatasetExecutor, TestResult } from './executor.interface';
import {
  validateTargetUrl,
  validateRedirect,
  DEFAULT_MAX_RESPONSE_BYTES,
} from '@/modules/dataset/utils/ssrf-guard';

/**
 * API 数据集执行器（后端代理）
 *
 * 设计依据：
 * - `docs/specs/dataset-management/architecture.md` §5.5（后端代理 vs 前端直连）
 * - `docs/specs/dataset-management/security-decisions.md` §2（后端代理决策）
 * - `docs/specs/dataset-management/security-decisions.md` §2.4（SSRF 防护）
 *
 * 安全措施：
 * - SSRF 防护：协议白名单、内网 IP 拦截、重定向复核（最多 3 次）、响应大小上限 5MB
 * - 超时控制：默认 10s
 * - 第一阶段：connectionId 不启用，path 必须为完整 URL，鉴权在 config.headers 配置
 */
@Injectable()
export class ApiExecutor implements DatasetExecutor<ApiDatasetConfig> {
  /** 请求超时（毫秒） */
  private readonly timeoutMs = 10_000;

  async execute(config: ApiDatasetConfig, params: Record<string, unknown>): Promise<unknown> {
    const { url, init } = this.buildRequest(config, params);
    const response = await this.fetchWithSsrfGuard(url, init);
    return response;
  }

  async test(config: ApiDatasetConfig, params: Record<string, unknown>): Promise<TestResult> {
    const start = Date.now();
    const raw = await this.execute(config, params);
    return {
      raw,
      parsed: raw,
      meta: { durationMs: Date.now() - start },
    };
  }

  /**
   * 构建 fetch 请求参数
   *
   * 第一阶段：connectionId 不启用，path 必须为完整 URL。
   * 后续阶段启用 connectionId 后，此处拼接 connection.baseUrl + path。
   */
  private buildRequest(
    config: ApiDatasetConfig,
    params: Record<string, unknown>,
  ): { url: string; init: RequestInit } {
    // 第一阶段：path 必须为完整 URL（service 层已校验）
    const url = config.path;

    // 合并 headers
    const headers: Record<string, string> = { ...config.headers };

    // 根据 contentType 设置 Content-Type（GET / DELETE 无 body 时不强制）
    const hasBody =
      config.body !== undefined && config.method !== 'GET' && config.method !== 'DELETE';
    if (hasBody) {
      switch (config.contentType) {
        case 'json':
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
          break;
        case 'form-data':
          // form-data 由 fetch 自动设置 boundary，不预设 Content-Type
          break;
        case 'x-www-form-urlencoded':
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/x-www-form-urlencoded';
          break;
      }
    }

    const init: RequestInit = {
      method: config.method,
      headers,
      redirect: 'manual', // 手动处理重定向以做 SSRF 复核
      signal: AbortSignal.timeout(this.timeoutMs),
    };

    if (hasBody) {
      init.body = this.serializeBody(config.body, config.contentType, params);
    }

    return { url, init };
  }

  /**
   * 序列化请求体
   *
   * 返回类型为 `string | FormData`：
   * - json / x-www-form-urlencoded / default → string
   * - form-data → FormData（fetch 自动设置 boundary）
   *
   * 不使用 `BodyInit` 是因为项目 tsconfig 的 lib 仅含 ES2023，
   * `BodyInit` 属于 undici-types 导出类型，未在全局声明。
   */
  private serializeBody(
    body: unknown,
    contentType: ApiDatasetConfig['contentType'],
    params: Record<string, unknown>,
  ): string | FormData {
    switch (contentType) {
      case 'json':
        return JSON.stringify(this.interpolateParams(body, params));
      case 'x-www-form-urlencoded': {
        const data = this.interpolateParams(body, params);
        if (data && typeof data === 'object') {
          return new URLSearchParams(data as Record<string, string>).toString();
        }
        return String(data);
      }
      case 'form-data': {
        const data = this.interpolateParams(body, params);
        const formData = new FormData();
        if (data && typeof data === 'object') {
          for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            formData.append(key, String(value));
          }
        }
        return formData;
      }
      default:
        return JSON.stringify(body);
    }
  }

  /**
   * 参数插值（简单实现：替换 {{paramName}} 占位符）
   *
   * 第一阶段只支持 body 内的字符串占位符替换。
   * 后续阶段可扩展为 JSONPath 级别的深度插值。
   */
  private interpolateParams(body: unknown, params: Record<string, unknown>): unknown {
    if (body === null || body === undefined) return body;
    if (typeof body === 'string') {
      return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
        return key in params ? String(params[key]) : match;
      });
    }
    if (typeof body === 'object') {
      if (Array.isArray(body)) {
        return body.map((item) => this.interpolateParams(item, params));
      }
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        result[key] = this.interpolateParams(value, params);
      }
      return result;
    }
    return body;
  }

  /**
   * 执行 HTTP 请求并做 SSRF 防护
   *
   * - 首次请求前校验目标 URL
   * - 手动跟随重定向（最多 MAX_REDIRECTS 次），每次重新校验目标
   * - 响应大小上限 DEFAULT_MAX_RESPONSE_BYTES
   */
  private async fetchWithSsrfGuard(url: string, init: RequestInit): Promise<unknown> {
    // 首次目标校验
    await validateTargetUrl(url);

    let currentUrl = url;
    let currentInit = init;
    let redirectCount = 0;

    while (true) {
      const response = await fetch(currentUrl, currentInit);

      // 处理重定向（3xx）
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
            '重定向响应缺少 Location 头',
          ]);
        }

        redirectCount++;
        const redirectUrl = new URL(location, currentUrl).href;
        // 重定向目标校验
        await validateRedirect(redirectUrl, redirectCount);

        currentUrl = redirectUrl;
        // 重定向时移除 body 和 Content-Type（GET 请求）
        const { method, headers, signal } = currentInit;
        currentInit = {
          method: method === 'POST' ? 'GET' : method,
          headers,
          signal,
          redirect: 'manual',
        };
        continue;
      }

      // 非 2xx 响应视为执行失败
      if (!response.ok) {
        throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
          `HTTP ${response.status} ${response.statusText}`,
        ]);
      }

      // 响应大小校验
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > DEFAULT_MAX_RESPONSE_BYTES) {
        throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
          `响应大小超过上限（${DEFAULT_MAX_RESPONSE_BYTES} 字节）`,
        ]);
      }

      // 读取响应体并做大小上限保护
      // 显式类型标注：response.body 为 ReadableStream<any>，getReader 返回 ReadableStreamDefaultReader<any>，
      // 需断言为 Uint8Array reader 以满足 no-unsafe-assignment / no-unsafe-member-access 规则
      const reader = response.body?.getReader() as
        | ReadableStreamDefaultReader<Uint8Array>
        | undefined;
      if (!reader) {
        // 无 body 流，尝试 json()
        return response.json().catch(() => response.text());
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done || value === undefined) break;
        totalSize += value.byteLength;
        if (totalSize > DEFAULT_MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
            `响应大小超过上限（${DEFAULT_MAX_RESPONSE_BYTES} 字节）`,
          ]);
        }
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);
      const text = buffer.toString('utf-8');

      // 尝试 JSON 解析，失败则返回文本
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
}
