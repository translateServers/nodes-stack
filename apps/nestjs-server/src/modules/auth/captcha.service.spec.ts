import { Test, TestingModule } from '@nestjs/testing';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { RedisService } from '@/modules/redis/redis.service';
import { BusinessException } from '@/common/exceptions/business.exception';

const mockRedisClient = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
};

const mockRedisService = {
  client: mockRedisClient,
  ping: jest.fn().mockResolvedValue(true),
  safeExec: jest
    .fn()
    .mockImplementation(
      async <T>(fn: (client: typeof mockRedisClient) => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await fn(mockRedisClient);
        } catch {
          return fallback;
        }
      },
    ),
};

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CaptchaService, { provide: RedisService, useValue: mockRedisService }],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
  });

  describe('generateCaptcha', () => {
    it('should generate captcha with valid id and image', async () => {
      const result = await service.generateCaptcha();

      expect(result.captchaId).toBeDefined();
      expect(result.captchaImage).toBeDefined();
      expect(typeof result.captchaId).toBe('string');
      expect(typeof result.captchaImage).toBe('string');
    });

    it('should generate unique captcha IDs', async () => {
      const result1 = await service.generateCaptcha();
      const result2 = await service.generateCaptcha();

      expect(result1.captchaId).not.toBe(result2.captchaId);
    });

    it('should store captcha code in Redis with TTL', async () => {
      await service.generateCaptcha();

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('captcha:'),
        expect.any(String),
        { EX: 300 },
      );
    });
  });

  describe('verifyCaptcha', () => {
    it('should verify correct captcha code', async () => {
      mockRedisClient.get.mockResolvedValue('abcd');

      await expect(service.verifyCaptcha('test-id', 'abcd')).resolves.toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('captcha:test-id');
    });

    it('should verify captcha code case-insensitively', async () => {
      mockRedisClient.get.mockResolvedValue('abcd');

      await expect(service.verifyCaptcha('test-id', 'ABCD')).resolves.toBe(true);
    });

    it('should throw BusinessException for non-existent captcha', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.verifyCaptcha('non-existent-id', '1234')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for wrong captcha code', async () => {
      mockRedisClient.get.mockResolvedValue('abcd');

      await expect(service.verifyCaptcha('test-id', 'wrong')).rejects.toThrow(BusinessException);
    });

    it('should delete captcha after successful verification', async () => {
      mockRedisClient.get.mockResolvedValue('abcd');

      await service.verifyCaptcha('test-id', 'abcd');

      expect(mockRedisClient.del).toHaveBeenCalledWith('captcha:test-id');
    });

    it('should delete captcha even when verification fails (prevent brute-force)', async () => {
      mockRedisClient.get.mockResolvedValue('abcd');

      try {
        await service.verifyCaptcha('test-id', 'wrong');
      } catch {
        // expected
      }

      // 无论验证成功或失败，都应删除验证码（防止暴力破解）
      expect(mockRedisClient.del).toHaveBeenCalledWith('captcha:test-id');
    });
  });
});
