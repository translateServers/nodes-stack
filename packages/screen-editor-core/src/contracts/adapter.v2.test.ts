/**
 * V2 error pipeline tests（Spec §12.4 + Requirement 3 + Requirement 7 + Requirement 8, Task 5.3）
 *
 * 仅测试 V2 业务约束（不测 Zod 框架自身能力）：
 * - V2 diagnostics（V2 codes + registry error codes）通过 toScreenPublicErrorV2 保留
 * - ScreenAdapterError 携带 V2 diagnostics 时脱敏 path/message，剥离原始 message/stack/cause/response
 * - ScreenComponentRegistryError 升级为 V2 adapter error（code=VALIDATION），
 *   SDK 内部诊断升级为 V2 diagnostics（code=registry error code）
 * - SDK 内部细分 code 不暴露到 V2 公共诊断
 * - AbortSignal cancellation → ABORTED，无 diagnostics
 * - Unknown error → UNKNOWN，无 diagnostics
 * - V1 codes 通过 V2 pipeline 仍能正常处理
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeScreenAdapterErrorV2,
  ScreenAdapterErrorCode,
  toScreenPublicErrorV2,
  type ScreenAdapterErrorV2,
  type ScreenSdkDiagnosticV2,
} from './index.js';
import {
  ScreenComponentRegistryErrorImpl,
  type ScreenComponentRegistryError,
} from '../registry/registry-error.js';

// ===== Test helpers =====

function createRegistryError(
  code: ScreenComponentRegistryError['code'],
  diagnostics: readonly ScreenSdkDiagnosticV2[] = [],
): ScreenComponentRegistryError {
  return new ScreenComponentRegistryErrorImpl(code, `[test] registry error (${code})`, diagnostics);
}

// ===== Tests =====

describe('toScreenPublicErrorV2 — V2 diagnostics preservation (Spec §12.4)', () => {
  it('preserves V2 codes (MISSING_COMPONENT_DEFINITION) through the pipeline', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'internal details',
      code: ScreenAdapterErrorCode.UNSUPPORTED_DOCUMENT_FEATURE,
      diagnostics: [
        {
          code: 'MISSING_COMPONENT_DEFINITION',
          path: ['components', 0, 'type'],
          severity: 'error',
          message: '组件类型 "acme.kpi/v1" 未在注册表中定义',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.UNSUPPORTED_DOCUMENT_FEATURE);
    expect(publicError.diagnostics).toEqual([
      {
        code: 'MISSING_COMPONENT_DEFINITION',
        path: ['components', 0, 'type'],
        severity: 'error',
        message: '组件类型未在注册表中定义。',
      },
    ]);
  });

  it('preserves UNSUPPORTED_COMPONENT_CAPABILITY diagnostics with sanitized message', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'internal',
      code: ScreenAdapterErrorCode.UNSUPPORTED_DOCUMENT_FEATURE,
      diagnostics: [
        {
          code: 'UNSUPPORTED_COMPONENT_CAPABILITY',
          path: ['components', 1, 'dataSource'],
          severity: 'error',
          message: '外部组件不支持 dataSource 配置 (raw value=secret)',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'UNSUPPORTED_COMPONENT_CAPABILITY',
        path: ['components', 1, 'dataSource'],
        severity: 'error',
        message: '外部组件不支持该能力配置。',
      },
    ]);
    expect(JSON.stringify(publicError)).not.toContain('secret');
  });

  it('preserves INVALID_COMPONENT_EVENT diagnostics with sanitized message', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'internal',
      code: ScreenAdapterErrorCode.UNSUPPORTED_DOCUMENT_FEATURE,
      diagnostics: [
        {
          code: 'INVALID_COMPONENT_EVENT',
          path: ['blueprint', 'edges', 0, 'sourceHandle'],
          severity: 'error',
          message: '蓝图事件锚点 evt:click 不在 manifest.events [refresh] 中',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_COMPONENT_EVENT',
        path: ['blueprint', 'edges', 0, 'sourceHandle'],
        severity: 'error',
        message: '蓝图事件锚点不在组件 manifest.events 声明列表中。',
      },
    ]);
  });

  it('still processes V1 codes (INVALID_DOCUMENT) through V2 pipeline', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'validation failed',
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [
        {
          code: 'INVALID_DOCUMENT',
          path: ['canvas', 'components'],
          severity: 'error',
          message: 'canvas.width 必须为正数',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_DOCUMENT',
        path: ['canvas', 'components'],
        severity: 'error',
        message: '文档字段校验失败。',
      },
    ]);
  });
});

describe('toScreenPublicErrorV2 — sanitization (Spec §12.4 security)', () => {
  it('strips Adapter original message/stack/cause/response fields', () => {
    const hostileError = {
      name: 'ScreenAdapterError',
      message: 'Bearer secret-token; cookie=session-secret',
      code: ScreenAdapterErrorCode.CONFLICT,
      recoverable: true,
      serverRevision: 'revision-2',
      response: { authorization: 'secret-token' },
      stack: 'sensitive stack trace',
      cause: 'sensitive cause',
      custom: 'sensitive custom value',
    };

    const publicError = toScreenPublicErrorV2(hostileError);

    expect(publicError).toEqual({
      code: ScreenAdapterErrorCode.CONFLICT,
      message: '项目已被其他操作更新，请重新加载后重试。',
      recoverable: true,
      serverRevision: 'revision-2',
      diagnostics: undefined,
    });
    expect(JSON.stringify(publicError)).not.toContain('secret');
    expect(JSON.stringify(publicError)).not.toContain('sensitive');
  });

  it('replaces unknown path segments with <field> placeholder', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'validation failed',
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [
        {
          code: 'INVALID_COMPONENT_PROPS',
          path: ['components', 'secret-token-value', 'props', 'custom-secret-field'],
          severity: 'error',
          message: 'cookie=session-secret',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_COMPONENT_PROPS',
        path: ['components', '<field>', 'props', '<field>'],
        severity: 'error',
        message: '组件属性不符合 SDK 契约。',
      },
    ]);
    expect(JSON.stringify(publicError)).not.toContain('secret');
  });

  it('drops diagnostics with hostile shape without throwing', () => {
    const adapterError = {
      name: 'ScreenAdapterError',
      message: 'validation failed',
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [
        { not: 'a valid diagnostic' },
        { code: 'INVALID_DOCUMENT', path: 'not-an-array', severity: 'error', message: 'x' },
        { code: '', path: [], severity: 'error', message: 'empty code' },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toBeUndefined();
  });

  it('drops diagnostics with severity other than error/warning', () => {
    const adapterError = {
      name: 'ScreenAdapterError',
      message: 'validation failed',
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [
        {
          code: 'INVALID_DOCUMENT',
          path: ['canvas'],
          severity: 'critical',
          message: 'invalid',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toBeUndefined();
  });

  it('preserves manifest-related path segments in registry error diagnostics', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'internal',
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [
        {
          code: 'INVALID_COMPONENT_MANIFEST',
          path: ['manifest', 'apiVersion', 'type', 'tagName', 'propsSchema', 'properties'],
          severity: 'error',
          message: 'manifest field invalid',
        },
      ],
    };

    const publicError = toScreenPublicErrorV2(adapterError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['manifest', 'apiVersion', 'type', 'tagName', 'propsSchema', 'properties'],
        severity: 'error',
        message: '组件 manifest 校验失败。',
      },
    ]);
  });
});

describe('toScreenPublicErrorV2 — registry error upgrade (Spec §12.4 + Requirement 3)', () => {
  it('upgrades ScreenComponentRegistryError to V2 adapter error with VALIDATION code', () => {
    const sdkDiagnostics: ScreenSdkDiagnosticV2[] = [
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['type'],
        severity: 'error',
        message: 'type "acme.kpi/v1" 不合法',
      },
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['apiVersion'],
        severity: 'error',
        message: 'apiVersion 必须为 nebula.screen-component/v1，实际为 nebula.screen-component/v2',
      },
    ];
    const registryError = createRegistryError('INVALID_COMPONENT_MANIFEST', sdkDiagnostics);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.VALIDATION);
    expect(publicError.message).toBe('数据校验失败。');
    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['type'],
        severity: 'error',
        message: '组件 manifest 校验失败。',
      },
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['apiVersion'],
        severity: 'error',
        message: '组件 manifest 校验失败。',
      },
    ]);
  });

  it('uses UNSUPPORTED_COMPONENT_API_VERSION registry code when apiVersion mismatches', () => {
    const sdkDiagnostics: ScreenSdkDiagnosticV2[] = [
      {
        code: 'UNSUPPORTED_COMPONENT_API_VERSION',
        path: ['apiVersion'],
        severity: 'error',
        message: 'apiVersion 必须为 nebula.screen-component/v1，实际为 v2',
      },
    ];
    const registryError = createRegistryError('UNSUPPORTED_COMPONENT_API_VERSION', sdkDiagnostics);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.VALIDATION);
    expect(publicError.diagnostics).toEqual([
      {
        code: 'UNSUPPORTED_COMPONENT_API_VERSION',
        path: ['apiVersion'],
        severity: 'error',
        message: '组件 API 版本不受支持。',
      },
    ]);
  });

  it('keeps the registry error code stable across multiple diagnostics', () => {
    const sdkDiagnostics: ScreenSdkDiagnosticV2[] = [
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['type'],
        severity: 'error',
        message: 'type 不合法',
      },
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['propsSchema'],
        severity: 'error',
        message: 'propsSchema 节点必须是 plain object',
      },
    ];
    const registryError = createRegistryError('INVALID_COMPONENT_MANIFEST', sdkDiagnostics);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.diagnostics).toBeDefined();
    for (const diagnostic of publicError.diagnostics ?? []) {
      expect(diagnostic.code).toBe('INVALID_COMPONENT_MANIFEST');
    }
  });

  it('returns undefined diagnostics when registry error has no SDK diagnostics (e.g. duplicate type)', () => {
    const registryError = createRegistryError('DUPLICATE_COMPONENT_TYPE', []);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.VALIDATION);
    expect(publicError.diagnostics).toBeUndefined();
  });

  it('upgrades DUPLICATE_COMPONENT_TAG_NAME registry error with diagnostics', () => {
    const sdkDiagnostics: ScreenSdkDiagnosticV2[] = [
      {
        code: 'DUPLICATE_COMPONENT_TAG_NAME',
        path: ['tagName'],
        severity: 'error',
        message: 'tagName "acme-kpi-v1" 已被注册',
      },
    ];
    const registryError = createRegistryError('DUPLICATE_COMPONENT_TAG_NAME', sdkDiagnostics);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'DUPLICATE_COMPONENT_TAG_NAME',
        path: ['tagName'],
        severity: 'error',
        message: '组件 tagName 已被注册。',
      },
    ]);
  });

  it('upgrades COMPONENT_DEFINE_FAILED registry error with empty diagnostics', () => {
    const registryError = createRegistryError('COMPONENT_DEFINE_FAILED');

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.VALIDATION);
    expect(publicError.diagnostics).toBeUndefined();
  });

  it('sanitizes SDK diagnostics path segments through registry upgrade', () => {
    const sdkDiagnostics: ScreenSdkDiagnosticV2[] = [
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['manifest', 'sensitive-field', 'apiVersion'],
        severity: 'error',
        message: 'raw value=secret',
      },
    ];
    const registryError = createRegistryError('INVALID_COMPONENT_MANIFEST', sdkDiagnostics);

    const publicError = toScreenPublicErrorV2(registryError);

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['manifest', '<field>', 'apiVersion'],
        severity: 'error',
        message: '组件 manifest 校验失败。',
      },
    ]);
    expect(JSON.stringify(publicError)).not.toContain('secret');
  });
});

describe('toScreenPublicErrorV2 — abort and unknown handling', () => {
  it('maps AbortSignal cancellation to ABORTED without diagnostics', () => {
    const controller = new AbortController();
    controller.abort();

    const publicError = toScreenPublicErrorV2(new Error('late response'), controller.signal);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.ABORTED);
    expect(publicError.recoverable).toBe(true);
    expect(publicError.diagnostics).toBeUndefined();
    expect(publicError.message).toBe('操作已取消。');
  });

  it('maps DOMException AbortError to ABORTED without signal', () => {
    const abortError = new DOMException('aborted', 'AbortError');

    const publicError = toScreenPublicErrorV2(abortError);

    expect(publicError.code).toBe(ScreenAdapterErrorCode.ABORTED);
    expect(publicError.recoverable).toBe(true);
  });

  it('maps unknown error to UNKNOWN without diagnostics', () => {
    const publicError = toScreenPublicErrorV2(new Error('something went wrong'));

    expect(publicError.code).toBe(ScreenAdapterErrorCode.UNKNOWN);
    expect(publicError.diagnostics).toBeUndefined();
    expect(publicError.message).toBe('操作失败，请稍后重试。');
    expect(JSON.stringify(publicError)).not.toContain('something went wrong');
  });

  it('maps non-Error throwables to UNKNOWN', () => {
    const publicError = toScreenPublicErrorV2('just a string');

    expect(publicError.code).toBe(ScreenAdapterErrorCode.UNKNOWN);
    expect(publicError.diagnostics).toBeUndefined();
  });
});

describe('normalizeScreenAdapterErrorV2 — direct normalize behavior', () => {
  it('returns ScreenAdapterErrorV2 with name=ScreenAdapterErrorV2', () => {
    const normalized = normalizeScreenAdapterErrorV2(new Error('unknown'));

    expect(normalized).toBeInstanceOf(Error);
    expect((normalized as Error).name).toBe('ScreenAdapterErrorV2');
  });

  it('preserves serverRevision from ScreenAdapterError', () => {
    const adapterError: ScreenAdapterErrorV2 = {
      name: 'ScreenAdapterError',
      message: 'conflict',
      code: ScreenAdapterErrorCode.CONFLICT,
      serverRevision: 'revision-99',
    };

    const normalized = normalizeScreenAdapterErrorV2(adapterError);

    expect(normalized.serverRevision).toBe('revision-99');
    expect(normalized.code).toBe(ScreenAdapterErrorCode.CONFLICT);
  });

  it('returns ABORTED instance when signal already aborted', () => {
    const controller = new AbortController();
    controller.abort();

    const normalized = normalizeScreenAdapterErrorV2(new Error('not aborted'), controller.signal);

    expect(normalized.code).toBe(ScreenAdapterErrorCode.ABORTED);
    expect(normalized.recoverable).toBe(true);
  });

  it('returns VALIDATION when ScreenComponentRegistryError is thrown', () => {
    const registryError = createRegistryError('INVALID_COMPONENT_MANIFEST', [
      {
        code: 'INVALID_COMPONENT_MANIFEST',
        path: ['type'],
        severity: 'error',
        message: 'invalid',
      },
    ]);

    const normalized = normalizeScreenAdapterErrorV2(registryError);

    expect(normalized.code).toBe(ScreenAdapterErrorCode.VALIDATION);
    expect(normalized.diagnostics).toBeDefined();
    expect(normalized.diagnostics?.[0]?.code).toBe('INVALID_COMPONENT_MANIFEST');
  });
});
