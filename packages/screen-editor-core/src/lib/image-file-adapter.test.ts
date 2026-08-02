import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ImageFileError,
  SUPPORTED_IMAGE_MIME_TYPES,
  isSupportedImageType,
  readFileAsDataUrl,
  getImageDimensions,
  parseDataUrl,
  isPersistableImageResource,
  type ImageFileResult,
} from './image-file-adapter';

/**
 * 任务 7.3/7.5 验证：图片文件选择适配层
 *
 * 测试覆盖：
 * - MIME 类型校验（支持/不支持）
 * - readFileAsDataUrl 成功/失败
 * - getImageDimensions 成功/失败
 * - parseDataUrl 解析 data URL
 * - isPersistableImageResource 拒绝 file:// 和 blob:
 */
describe('isSupportedImageType', () => {
  it('接受所有声明的支持类型', () => {
    for (const mime of SUPPORTED_IMAGE_MIME_TYPES) {
      expect(isSupportedImageType(mime)).toBe(true);
    }
  });

  it('拒绝未声明的类型', () => {
    expect(isSupportedImageType('image/bmp')).toBe(false);
    expect(isSupportedImageType('application/pdf')).toBe(false);
    expect(isSupportedImageType('text/plain')).toBe(false);
    expect(isSupportedImageType('')).toBe(false);
  });
});

describe('readFileAsDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('成功读取返回 data URL 字符串', async () => {
    const mockResult = 'data:image/png;base64,ABC123';
    const fileReader = {
      readAsDataURL: vi.fn(function (this: {
        onload: (() => void) | null;
        result: unknown;
      }) {
        this.result = mockResult;
        // 模拟异步触发 onload
        setTimeout(() => this.onload?.(), 0);
      }),
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null as unknown,
      error: null,
    };
    // 必须为普通 function 才能被 new 调用
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return fileReader;
      }),
    );

    const file = new File(['fake'], 'test.png', { type: 'image/png' });
    const result = await readFileAsDataUrl(file);
    expect(result).toBe(mockResult);
    expect(fileReader.readAsDataURL).toHaveBeenCalledWith(file);
  });

  it('FileReader 出错时 reject ImageFileError', async () => {
    const fileReader = {
      readAsDataURL: vi.fn(function (this: {
        onerror: (() => void) | null;
        error: Error | null;
      }) {
        this.error = new Error('读取错误');
        setTimeout(() => this.onerror?.(), 0);
      }),
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null as unknown,
      error: null as Error | null,
    };
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return fileReader;
      }),
    );

    const file = new File(['fake'], 'test.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).rejects.toThrow(ImageFileError);
  });

  it('FileReader 返回非字符串结果时 reject', async () => {
    const fileReader = {
      readAsDataURL: vi.fn(function (this: {
        onload: (() => void) | null;
        result: unknown;
      }) {
        this.result = new ArrayBuffer(0); // 非字符串
        setTimeout(() => this.onload?.(), 0);
      }),
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null as unknown,
      error: null,
    };
    vi.stubGlobal(
      'FileReader',
      vi.fn(function () {
        return fileReader;
      }),
    );

    const file = new File(['fake'], 'test.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).rejects.toMatchObject({ code: 'READ_FAILED' });
  });
});

describe('getImageDimensions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('成功加载返回 naturalWidth/Height', async () => {
    // 模拟 Image 构造函数（必须为普通 function 才能被 new 调用）
    vi.stubGlobal(
      'Image',
      vi.fn(function (this: MockImageInstance) {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        // 拦截 src setter，触发 onload 并设置 naturalWidth/Height
        Object.defineProperty(this, 'src', {
          set(this: MockImageInstance) {
            this.naturalWidth = 800;
            this.naturalHeight = 600;
            setTimeout(() => this.onload?.(), 0);
          },
          get(): string {
            return '';
          },
        });
      }),
    );

    const dimensions = await getImageDimensions('data:image/png;base64,ABC');
    expect(dimensions).toEqual({ width: 800, height: 600 });
  });

  it('图片加载失败时 reject ImageFileError', async () => {
    vi.stubGlobal(
      'Image',
      vi.fn(function (this: MockImageInstance) {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        Object.defineProperty(this, 'src', {
          set(this: Pick<MockImageInstance, 'onerror'>) {
            setTimeout(() => this.onerror?.(), 0);
          },
          get(): string {
            return '';
          },
        });
      }),
    );

    await expect(getImageDimensions('invalid')).rejects.toMatchObject({ code: 'LOAD_FAILED' });
  });
});

/** Mock Image 构造函数实例的形状，用于 getter/setter 内部 this 类型标注 */
interface MockImageInstance {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

describe('parseDataUrl', () => {
  it('解析有效的 data URL', () => {
    const result = parseDataUrl('data:image/png;base64,ABC123==');
    expect(result).toEqual({ mimeType: 'image/png', base64: 'ABC123==' });
  });

  it('解析 SVG data URL', () => {
    const result = parseDataUrl('data:image/svg+xml;base64,PHN2Zz4=');
    expect(result).toEqual({ mimeType: 'image/svg+xml', base64: 'PHN2Zz4=' });
  });

  it('非 data URL 返回 null', () => {
    expect(parseDataUrl('https://example.com/image.png')).toBeNull();
    expect(parseDataUrl('file:///C:/image.png')).toBeNull();
    expect(parseDataUrl('blob:http://example.com/abc-123')).toBeNull();
  });

  it('缺少 base64 标记返回 null', () => {
    expect(parseDataUrl('data:image/png,ABC')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(parseDataUrl('')).toBeNull();
  });
});

describe('isPersistableImageResource', () => {
  it('接受 data:image/* URL', () => {
    expect(isPersistableImageResource('data:image/png;base64,ABC')).toBe(true);
    expect(isPersistableImageResource('data:image/jpeg;base64,DEF')).toBe(true);
    expect(isPersistableImageResourcesHelper('data:image/svg+xml;base64,GHI')).toBe(true);
  });

  it('接受 http/https URL', () => {
    expect(isPersistableImageResource('http://example.com/image.png')).toBe(true);
    expect(isPersistableImageResource('https://example.com/image.jpg')).toBe(true);
  });

  it('拒绝 file:// 本地绝对路径', () => {
    expect(isPersistableImageResource('file:///C:/Users/image.png')).toBe(false);
    expect(isPersistableImageResource('file:///home/user/photo.jpg')).toBe(false);
  });

  it('拒绝 blob: 临时 object URL', () => {
    expect(isPersistableImageResource('blob:http://example.com/abc-123')).toBe(false);
    expect(isPersistableImageResource('blob:null/def-456')).toBe(false);
  });

  it('拒绝空字符串和其他协议', () => {
    expect(isPersistableImageResource('')).toBe(false);
    expect(isPersistableImageResource('ftp://example.com/image.png')).toBe(false);
  });
});

// helper 函数，仅为类型检查辅助（无运行时差异）
function isPersistableImageResourcesHelper(src: string): boolean {
  return isPersistableImageResource(src);
}

describe('ImageFileError', () => {
  it('携带 code 字段', () => {
    const err = new ImageFileError('测试错误', 'INVALID_TYPE');
    expect(err.message).toBe('测试错误');
    expect(err.code).toBe('INVALID_TYPE');
    expect(err.name).toBe('ImageFileError');
  });

  it('所有 code 值可被构造', () => {
    expect(new ImageFileError('a', 'INVALID_TYPE').code).toBe('INVALID_TYPE');
    expect(new ImageFileError('b', 'READ_FAILED').code).toBe('READ_FAILED');
    expect(new ImageFileError('c', 'LOAD_FAILED').code).toBe('LOAD_FAILED');
  });
});

describe('ImageFileResult 类型契约', () => {
  it('符合任务 7.1 资源契约：dataUrl + 尺寸 + 文件名', () => {
    const result: ImageFileResult = {
      dataUrl: 'data:image/png;base64,ABC',
      width: 800,
      height: 600,
      name: 'test.png',
    };
    expect(result.dataUrl).toMatch(/^data:image\//);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.name).toBe('test.png');
  });
});
