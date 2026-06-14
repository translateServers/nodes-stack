import { Injectable, Logger } from '@nestjs/common';
import { create } from 'svg-captcha';
import { randomUUID } from 'crypto';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { CaptchaResponse } from '@/modules/auth/dto/auth.dto';
import { RedisService } from '@/modules/redis/redis.service';

const CAPTCHA_KEY_PREFIX = 'captcha:';
const CAPTCHA_EXPIRES_SECONDS = 5 * 60;

/**
 * 验证码服务
 *
 * 使用 Redis 存储验证码数据，支持多实例部署。
 * 验证码在 Redis 中自带 TTL，到期后自动清除。
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly redisService: RedisService) {}

  generateCaptcha(): CaptchaResponse {
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

    // 异步写入 Redis，不阻塞响应
    this.redisService.client
      .set(`${CAPTCHA_KEY_PREFIX}${captchaId}`, code, { EX: CAPTCHA_EXPIRES_SECONDS })
      .catch((err) => this.logger.error(`Failed to store captcha: ${(err as Error).message}`));

    return {
      captchaId,
      captchaImage: captcha.data,
    };
  }

  async verifyCaptcha(captchaId: string, userCode: string): Promise<boolean> {
    const key = `${CAPTCHA_KEY_PREFIX}${captchaId}`;
    const storedCode = await this.redisService.client.get(key);

    if (!storedCode) {
      // 无法区分"不存在"和"已过期"，统一提示验证码无效
      throw new BusinessException(BizCode.AUTH_CAPTCHA_NOT_FOUND);
    }

    // 验证后立即删除，确保一次性使用
    await this.redisService.client.del(key);

    if (storedCode !== userCode.toLowerCase()) {
      throw new BusinessException(BizCode.AUTH_CAPTCHA_INVALID);
    }

    return true;
  }
}
