import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE_KEY = 'skipThrottle';

/**
 * 跳过速率限制的装饰器
 *
 * 标记的接口不受 ThrottlerGuard 限制。
 * 适用于健康检查等高频但无安全风险的端点。
 */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
