import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from '@/modules/auth/dto/auth.dto';
import type { RequestWithUser } from '@/common/guards/jwt-auth.guard';
import type { UserPayload } from '@/common/interfaces/user.interface';

type AuthenticatedRequest = RequestWithUser & { user: UserPayload };

const mockAuthService = {
  loginWithCredentials: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
};

const mockUserService = {
  findOne: jest.fn(),
};

const mockCaptchaService = {
  generateCaptcha: jest.fn(),
  verifyCaptcha: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  describe('getCaptcha', () => {
    it('should return captcha response', async () => {
      const mockCaptchaResponse = {
        captchaId: 'captcha-id',
        captchaImage: 'svg-image-data',
      };
      mockCaptchaService.generateCaptcha.mockResolvedValue(mockCaptchaResponse);

      const result = await controller.getCaptcha();

      expect(mockCaptchaService.generateCaptcha).toHaveBeenCalled();
      expect(result).toEqual(mockCaptchaResponse);
    });
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password123',
        name: 'New User',
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      mockAuthService.register.mockResolvedValue(mockTokens);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    it('should verify captcha and return tokens', async () => {
      const loginDto: LoginDto = {
        account: 'test@example.com',
        password: 'password123',
        captchaId: 'captcha-id',
        captchaCode: '1234',
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      mockAuthService.loginWithCredentials.mockResolvedValue(mockTokens);

      const result = await controller.login(loginDto);

      expect(mockCaptchaService.verifyCaptcha).toHaveBeenCalledWith(
        loginDto.captchaId,
        loginDto.captchaCode,
      );
      expect(mockAuthService.loginWithCredentials).toHaveBeenCalledWith(
        loginDto.account,
        loginDto.password,
      );
      expect(result).toEqual(mockTokens);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'old-refresh-token',
      };

      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      mockAuthService.refreshToken.mockResolvedValue(mockTokens);

      const result = await controller.refresh(refreshTokenDto);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      const req: Partial<AuthenticatedRequest> = {
        user: { id: 'user-id', roles: [] },
      };

      await controller.logout(req as AuthenticatedRequest);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-id');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
      };
      mockUserService.findOne.mockResolvedValue(mockUser);

      const req: Partial<AuthenticatedRequest> = {
        user: { id: 'user-id', roles: [] },
      };
      const result = await controller.getProfile(req as AuthenticatedRequest);

      expect(mockUserService.findOne).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        name: mockUser.name,
      });
    });

    it('should return user profile with null name', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        name: null,
      };
      mockUserService.findOne.mockResolvedValue(mockUser);

      const req: Partial<AuthenticatedRequest> = {
        user: { id: 'user-id', roles: [] },
      };
      const result = await controller.getProfile(req as AuthenticatedRequest);

      expect(result.name).toBeNull();
    });
  });
});
