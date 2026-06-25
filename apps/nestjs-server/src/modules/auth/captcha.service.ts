import { Injectable, Logger } from '@nestjs/common';
import { create } from 'svg-captcha';
import { randomUUID } from 'crypto';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { CaptchaResponse } from '@/modules/auth/dto/auth.dto';
import { RedisService } from '@/modules/redis/redis.service';

const CAPTCHA_KEY_PREFIX = 'captcha:';
const CAPTCHA_EXPIRES_SECONDS = 5 * 60;

/**
 * 验证码服务
 *
 * 使用 Redis 存储验证码数据，支持多实例部署。
 * 验证码在 Redis 中自带 TTL，到期后自动清除。
 *
 * **容灾策略**：Redis 不可用时降级为内存存储，不影响服务可用性。
 * 注意：内存存储仅适用于单实例，重启后丢失。
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  /**
   * 内存降级缓存（Redis 不可用时使用）。
   * key: captchaId, value: { code, expiresAt }
   */
  private readonly memoryCache = new Map<string, { code: string; expiresAt: number }>();

  constructor(private readonly redisService: RedisService) {}

  async generateCaptcha(): Promise<CaptchaResponse> {
    const captcha = create({
      size: 4,
      noise: 3,
      color: true,
      background: '#f0f0f0',
      width: 120,
      height: 40,
    });

    const captchaId = randomUUID();
    const code = captcha.text.toLowerCase();

    // 优先写入 Redis，失败时降级到内存
    const redisKey = `${CAPTCHA_KEY_PREFIX}${captchaId}`;
    const result = await this.redisService.safeExec(
      (client) => client.set(redisKey, code, { EX: CAPTCHA_EXPIRES_SECONDS }),
      null, // fallback: Redis 不可用时返回 null
    );

    if (result === null) {
      // Redis 不可用，降级到内存
      this.logger.warn('Redis unavailable, storing captcha in memory fallback');
      this.memoryCache.set(captchaId, {
        code,
        expiresAt: Date.now() + CAPTCHA_EXPIRES_SECONDS * 1000,
      });
    }

    // 确保存储完成后再返回
    return {
      captchaId,
      captchaImage: captcha.data,
    };
  }

  async verifyCaptcha(captchaId: string, userCode: string): Promise<boolean> {
    const key = `${CAPTCHA_KEY_PREFIX}${captchaId}`;

    // 优先从 Redis 读取，失败时降级到内存
    const storedCode = await this.redisService.safeExec(
      (client) => client.get(key),
      null, // fallback: Redis 不可用时返回 null，后续检查内存缓存
    );

    let verifiedCode = storedCode;

    // Redis 未命中，尝试内存缓存
    if (!verifiedCode) {
      const memEntry = this.memoryCache.get(captchaId);
      if (memEntry) {
        if (Date.now() > memEntry.expiresAt) {
          this.memoryCache.delete(captchaId);
        } else {
          verifiedCode = memEntry.code;
        }
      }
    }

    if (!verifiedCode) {
      throw new BusinessException(BizCode.AUTH_CAPTCHA_NOT_FOUND);
    }

    // 验证后立即删除，确保一次性使用
    await this.redisService.safeExec((client) => client.del(key), 0).catch(() => {});
    this.memoryCache.delete(captchaId);

    if (verifiedCode !== userCode.toLowerCase()) {
      throw new BusinessException(BizCode.AUTH_CAPTCHA_INVALID);
    }

    return true;
  }
}
