/**
 * 图片文件选择适配层（任务 7.3）
 *
 * 职责：处理用户选择的图片文件，转换为可持久化的 data URL，并解析图片尺寸。
 * 不泄露本地绝对路径（file://）或临时 object URL（blob:）。
 *
 * 支持的文件类型：image/png、image/jpeg、image/gif、image/webp、image/svg+xml
 *
 * 失败语义：
 * - 用户取消：resolve(null)
 * - 文件类型不支持：reject(InvalidImageFileError)
 * - 读取失败：reject(ImageReadError)
 * - 尺寸解析失败：reject(ImageLoadError)
 */

/** 图片文件读取相关错误 */
export class ImageFileError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_TYPE' | 'READ_FAILED' | 'LOAD_FAILED',
  ) {
    super(message);
    this.name = 'ImageFileError';
  }
}

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

/**
 * 判断文件 MIME 类型是否受支持。
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * 图片文件解析结果。
 *
 * - `dataUrl`：base64 编码的 data URL，可持久化到 Store
 * - `width`/`height`：图片自然尺寸（像素），用于设置组件默认大小
 * - `name`：原始文件名（仅用于命名，不持久化到 src）
 */
export interface ImageFileResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

/**
 * 通过隐藏 input[type=file] 选择图片文件。
 *
 * 用户取消时 resolve(null)；选择有效文件时 resolve(ImageFileResult)。
 * 内部使用 Promise 封装，避免回调地狱。
 *
 * @returns 用户取消返回 null；否则返回解析后的图片数据
 */
export function pickImageFile(): Promise<ImageFileResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SUPPORTED_IMAGE_MIME_TYPES.join(',');
    // 隐藏 input，避免影响布局
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    document.body.appendChild(input);

    let settled = false;

    input.addEventListener('change', () => {
      void handleChange();
    });

    async function handleChange(): Promise<void> {
      if (settled) return;
      const file = input.files?.[0];
      // 用户取消选择
      if (!file) {
        settled = true;
        cleanup();
        resolve(null);
        return;
      }

      // 类型校验
      if (!isSupportedImageType(file.type)) {
        settled = true;
        cleanup();
        reject(new ImageFileError(`不支持的图片类型: ${file.type}`, 'INVALID_TYPE'));
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const dimensions = await getImageDimensions(dataUrl);
        settled = true;
        cleanup();
        resolve({
          dataUrl,
          width: dimensions.width,
          height: dimensions.height,
          name: file.name,
        });
      } catch (err) {
        settled = true;
        cleanup();
        if (err instanceof ImageFileError) {
          reject(err);
        } else {
          reject(new ImageFileError(`图片读取失败: ${(err as Error).message}`, 'READ_FAILED'));
        }
      }
    }

    // 用户点击取消（focus 回到文档且未选择文件）
    // 使用 once 的 blur 监听，避免重复触发
    const handleCancel = (): void => {
      if (settled) return;
      // 延迟检查，避免与 change 事件竞争
      setTimeout(() => {
        if (settled) return;
        if (!input.files || input.files.length === 0) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 300);
    };
    window.addEventListener('focus', handleCancel, { once: true });

    function cleanup(): void {
      window.removeEventListener('focus', handleCancel);
      document.body.removeChild(input);
    }

    input.click();
  });
}

/**
 * 读取文件为 data URL。
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new ImageFileError('FileReader 返回非字符串结果', 'READ_FAILED'));
      }
    };
    reader.onerror = () => {
      reject(
        new ImageFileError(`FileReader 错误: ${reader.error?.message ?? '未知'}`, 'READ_FAILED'),
      );
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 通过 Image 对象获取图片自然尺寸。
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new ImageFileError('图片加载失败，无法解析尺寸', 'LOAD_FAILED'));
    };
    img.src = src;
  });
}

/**
 * 任务 7.5：从 data URL 中提取 MIME 类型和 base64 数据。
 *
 * 用于资源释放审计：当 data URL 被替换或组件被删除时，调用方可通过本函数
 * 确认资源字段确实为 data URL（而非 blob: 或 file://）。
 */
export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) return null;
  return { mimeType: match[1], base64: match[2] };
}

/**
 * 任务 7.5：判断字符串是否为可安全持久化的图片资源。
 *
 * 拒绝 file://（本地绝对路径）和 blob:（临时 object URL）。
 */
export function isPersistableImageResource(src: string): boolean {
  if (src.startsWith('data:image/')) return true;
  if (src.startsWith('http://') || src.startsWith('https://')) return true;
  return false;
}
