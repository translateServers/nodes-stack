import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 6.4: 共享组件注册配置测试
 *
 * 验证：
 * - 单例缓存：多次调用返回同一 promise
 * - factory 返回包含内置 6 组件的 registry
 * - reject 时清除缓存允许重试
 * - isScreenComponentRegistryError 守卫
 *
 * 安全边界（Spec §14.2）：
 * - registry 与数据 runtime 正交
 * - 不绕过 production route switch gates
 */

const mockRegistry = {
  get: vi.fn(() => undefined),
  has: vi.fn(() => false),
  list: vi.fn(() => []),
  size: 0,
};

const createScreenComponentRegistryMock =
  vi.fn<(options?: { components?: readonly unknown[] }) => Promise<unknown>>();

vi.mock('@nebula/screen-sdk/components', () => ({
  createScreenComponentRegistry: createScreenComponentRegistryMock,
  isScreenComponentRegistryError: (error: unknown): boolean =>
    error !== null && typeof error === 'object' && 'code' in error && 'diagnostics' in error,
}));

describe('getNebulaScreenComponentRegistry', () => {
  beforeEach(() => {
    vi.resetModules();
    createScreenComponentRegistryMock.mockReset();
    mockRegistry.get.mockClear();
    mockRegistry.has.mockClear();
    mockRegistry.list.mockClear();
  });

  async function loadModule() {
    return import('./component-registry');
  }

  it('返回 promise 且内置 6 组件由 factory 自动注入', async () => {
    createScreenComponentRegistryMock.mockResolvedValue(mockRegistry);
    const { getNebulaScreenComponentRegistry } = await loadModule();

    const registry = await getNebulaScreenComponentRegistry();

    expect(registry).toBe(mockRegistry);
    expect(createScreenComponentRegistryMock).toHaveBeenCalledTimes(1);
    expect(createScreenComponentRegistryMock).toHaveBeenCalledWith({ components: [] });
  });

  it('单例缓存：多次调用返回同一 promise', async () => {
    createScreenComponentRegistryMock.mockResolvedValue(mockRegistry);
    const { getNebulaScreenComponentRegistry } = await loadModule();

    const promise1 = getNebulaScreenComponentRegistry();
    const promise2 = getNebulaScreenComponentRegistry();

    expect(promise1).toBe(promise2);
    await promise1;
    expect(createScreenComponentRegistryMock).toHaveBeenCalledTimes(1);
  });

  it('reject 时清除缓存，允许重试', async () => {
    const error = Object.assign(new Error('manifest invalid'), {
      code: 'INVALID_COMPONENT_MANIFEST',
      diagnostics: [],
    });
    createScreenComponentRegistryMock
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(mockRegistry);
    const { getNebulaScreenComponentRegistry } = await loadModule();

    // 首次调用 reject
    await expect(getNebulaScreenComponentRegistry()).rejects.toThrow('manifest invalid');

    // 重试应成功（缓存已清除）
    const registry = await getNebulaScreenComponentRegistry();
    expect(registry).toBe(mockRegistry);
    expect(createScreenComponentRegistryMock).toHaveBeenCalledTimes(2);
  });

  it('成功解析后不重复调用 factory', async () => {
    createScreenComponentRegistryMock.mockResolvedValue(mockRegistry);
    const { getNebulaScreenComponentRegistry } = await loadModule();

    await getNebulaScreenComponentRegistry();
    await getNebulaScreenComponentRegistry();
    await getNebulaScreenComponentRegistry();

    expect(createScreenComponentRegistryMock).toHaveBeenCalledTimes(1);
  });
});

describe('isScreenComponentRegistryError', () => {
  it('对带 code 和 diagnostics 的错误返回 true', async () => {
    const { isScreenComponentRegistryError } = await import('./component-registry');
    const error = {
      name: 'Error',
      message: 'fail',
      code: 'INVALID_COMPONENT_MANIFEST',
      diagnostics: [],
    };
    expect(isScreenComponentRegistryError(error)).toBe(true);
  });

  it('对普通 Error 返回 false', async () => {
    const { isScreenComponentRegistryError } = await import('./component-registry');
    expect(isScreenComponentRegistryError(new Error('plain'))).toBe(false);
  });

  it('对 null 和非对象返回 false', async () => {
    const { isScreenComponentRegistryError } = await import('./component-registry');
    expect(isScreenComponentRegistryError(null)).toBe(false);
    expect(isScreenComponentRegistryError(undefined)).toBe(false);
    expect(isScreenComponentRegistryError('string')).toBe(false);
  });
});
