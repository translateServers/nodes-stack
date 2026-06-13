import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { TypedConfigService } from '@/config/typed-config.service';
import { RegisterDto } from '@/modules/auth/dto/auth.dto';
import { mockPrismaService, mockJwtService } from '../../../test/setup';

const mockConfigData = {
  jwt: {
    secret: 'test-secret-that-is-at-least-32-characters-long',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    refreshSecret: 'test-refresh-secret-that-is-at-least-32-chars',
  },
};

const mockTypedConfigService = {
  get: jest.fn((path: string) => {
    const keys = path.split('.');
    let result: unknown = mockConfigData;
    for (const key of keys) {
      result = (result as Record<string, unknown>)[key];
    }
    return result;
  }),
};

const mockUserService = {
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findByAccount: jest.fn(),
  create: jest.fn(),
  validatePassword: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: TypedConfigService,
          useValue: mockTypedConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('loginWithCredentials', () => {
    it('should return tokens for valid credentials', async () => {
      const account = 'test@example.com';
      const password = 'password123';

      const mockUser = {
        id: 'user-id',
        email: account,
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
      };

      mockUserService.findByAccount.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('mock-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.loginWithCredentials(account, password);

      expect(mockUserService.findByAccount).toHaveBeenCalledWith(account);
      expect(mockUserService.validatePassword).toHaveBeenCalledWith(
        password,
        mockUser.password,
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw BusinessException for non-existent user', async () => {
      mockUserService.findByAccount.mockResolvedValue(null);

      await expect(
        service.loginWithCredentials('nonexistent', 'password'),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException for invalid password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
      };

      mockUserService.findByAccount.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(false);

      await expect(
        service.loginWithCredentials('testuser', 'wrong-password'),
      ).rejects.toThrow(BusinessException);
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

      const mockUser = {
        id: 'user-id',
        email: registerDto.email,
        username: registerDto.username,
        name: registerDto.name,
      };

      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockUserService.findByUsername).toHaveBeenCalledWith(
        registerDto.username,
      );
      expect(mockUserService.create).toHaveBeenCalledWith(registerDto);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw BusinessException for duplicate email', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        username: 'newuser',
        password: 'password123',
      };

      mockUserService.findByEmail.mockResolvedValue({ id: 'existing-id' });

      await expect(service.register(registerDto)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for duplicate username', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        username: 'existinguser',
        password: 'password123',
      };

      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue({ id: 'existing-id' });

      await expect(service.register(registerDto)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens and revoke old refresh token', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const hashedToken = createHash('sha256')
        .update(oldRefreshToken)
        .digest('hex');
      const mockStoredToken = {
        id: 'token-id',
        token: hashedToken,
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          password: 'hashed-password',
        },
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        mockStoredToken,
      );
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValue('new-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken(oldRefreshToken);

      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: hashedToken },
        include: { user: true },
      });
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id },
        data: { revoked: true },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw BusinessException for non-existent token', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for revoked token', async () => {
      const mockStoredToken = {
        id: 'token-id',
        token: 'revoked-token',
        revoked: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          password: 'hashed-password',
        },
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        mockStoredToken,
      );

      await expect(service.refreshToken('revoked-token')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException for expired token', async () => {
      const mockStoredToken = {
        id: 'token-id',
        token: 'expired-token',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          password: 'hashed-password',
        },
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        mockStoredToken,
      );

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all active refresh tokens for user', async () => {
      const userId = 'user-id';

      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.logout(userId);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revoked: false,
        },
        data: { revoked: true },
      });
    });
  });
});
