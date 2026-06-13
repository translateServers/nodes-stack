import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { create } from 'svg-captcha';
import { randomUUID } from 'crypto';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { CaptchaResponse } from '@/modules/auth/dto/auth.dto';

interface CaptchaData {
  code: string;
  expiresAt: number;
}

/**
 * 验证码服务
 *
 * 使用进程内 Map 存储验证码数据。
 * 注意：生产环境多实例部署时需替换为 Redis 等共享存储，
 * 以确保验证码在所有实例间可验证。
 */
@Injectable()
export class CaptchaService implements OnModuleInit, OnModuleDestroy {
  private captchaStore = new Map<string, CaptchaData>();
  private readonly CAPTCHA_EXPIRES_MS = 5 * 60 * 1000;
  private readonly MAX_STORE_SIZE = 10000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.cleanExpiredCaptchas(), 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  generateCaptcha(): CaptchaResponse {
    if (this.captchaStore.size >= this.MAX_STORE_SIZE) {
      this.cleanExpiredCaptchas();
    }

    const captcha = create({
      size: 4,
      noise: 3,
      color: true,
      background: '#f0f0f0',
      width: 120,
      height: 40,
    });

    const captchaId = randomUUID();
    const expiresAt = Date.now() + this.CAPTCHA_EXPIRES_MS;

    this.captchaStore.set(captchaId, {
      code: captcha.text.toLowerCase(),
      expiresAt,
    });

    return {
      captchaId,
      captchaImage: captcha.data,
    };
  }

  verifyCaptcha(captchaId: string, userCode: string): boolean {
    const captchaData = this.captchaStore.get(captchaId);

    if (!captchaData) {
      throw new BusinessException(BizCode.AUTH_CAPTCHA_NOT_FOUND);
    }

    if (Date.now() > captchaData.expiresAt) {
      this.captchaStore.delete(captchaId);
      throw new BusinessException(BizCode.AUTH_CAPTCHA_EXPIRED);
    }

    if (captchaData.code !== userCode.toLowerCase()) {
      throw new BusinessException(BizCode.AUTH_CAPTCHA_INVALID);
    }

    this.captchaStore.delete(captchaId);
    return true;
  }

  private cleanExpiredCaptchas(): void {
    const now = Date.now();
    for (const [id, data] of this.captchaStore) {
      if (now > data.expiresAt) {
        this.captchaStore.delete(id);
      }
    }
  }
}
