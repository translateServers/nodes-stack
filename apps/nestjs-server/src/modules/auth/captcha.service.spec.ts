import { Test, TestingModule } from '@nestjs/testing';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { BusinessException } from '@/common/exceptions/business.exception';

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaptchaService],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
  });

  describe('generateCaptcha', () => {
    it('should generate captcha with valid id and image', () => {
      const result = service.generateCaptcha();

      expect(result.captchaId).toBeDefined();
      expect(result.captchaImage).toBeDefined();
      expect(typeof result.captchaId).toBe('string');
      expect(typeof result.captchaImage).toBe('string');
    });

    it('should generate unique captcha IDs', () => {
      const result1 = service.generateCaptcha();
      const result2 = service.generateCaptcha();

      expect(result1.captchaId).not.toBe(result2.captchaId);
    });
  });

  describe('verifyCaptcha', () => {
    it('should verify correct captcha code', () => {
      const { captchaId } = service.generateCaptcha();
      const captchaStore = (
        service as unknown as {
          captchaStore: Map<string, { code: string; expiresAt: number }>;
        }
      ).captchaStore;
      const storedData = captchaStore.get(captchaId);
      if (!storedData) throw new Error('Captcha not found');
      const storedCode = storedData.code;

      expect(() => service.verifyCaptcha(captchaId, storedCode)).not.toThrow();
    });

    it('should verify captcha code case-insensitively', () => {
      const { captchaId } = service.generateCaptcha();
      const captchaStore = (
        service as unknown as {
          captchaStore: Map<string, { code: string; expiresAt: number }>;
        }
      ).captchaStore;
      const storedData = captchaStore.get(captchaId);
      if (!storedData) throw new Error('Captcha not found');
      const storedCode = storedData.code;

      expect(() =>
        service.verifyCaptcha(captchaId, storedCode.toUpperCase()),
      ).not.toThrow();
    });

    it('should throw BusinessException for non-existent captcha', () => {
      expect(() => service.verifyCaptcha('non-existent-id', '1234')).toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for wrong captcha code', () => {
      const { captchaId } = service.generateCaptcha();

      expect(() => service.verifyCaptcha(captchaId, 'wrong-code')).toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for expired captcha', () => {
      const { captchaId } = service.generateCaptcha();
      const captchaStore = (
        service as unknown as {
          captchaStore: Map<string, { code: string; expiresAt: number }>;
        }
      ).captchaStore;
      const data = captchaStore.get(captchaId);
      if (!data) throw new Error('Captcha not found');
      data.expiresAt = Date.now() - 1000;

      expect(() => service.verifyCaptcha(captchaId, data.code)).toThrow(
        BusinessException,
      );
    });

    it('should delete captcha after successful verification', () => {
      const { captchaId } = service.generateCaptcha();
      const captchaStore = (
        service as unknown as {
          captchaStore: Map<string, { code: string; expiresAt: number }>;
        }
      ).captchaStore;
      const storedData = captchaStore.get(captchaId);
      if (!storedData) throw new Error('Captcha not found');
      const storedCode = storedData.code;

      service.verifyCaptcha(captchaId, storedCode);

      expect(captchaStore.has(captchaId)).toBe(false);
    });

    it('should delete captcha after expiration check', () => {
      const { captchaId } = service.generateCaptcha();
      const captchaStore = (
        service as unknown as {
          captchaStore: Map<string, { code: string; expiresAt: number }>;
        }
      ).captchaStore;
      const data = captchaStore.get(captchaId);
      if (!data) throw new Error('Captcha not found');
      data.expiresAt = Date.now() - 1000;

      try {
        service.verifyCaptcha(captchaId, data.code);
      } catch {
        // expected
      }

      expect(captchaStore.has(captchaId)).toBe(false);
    });
  });
});
