import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import dayjs from 'dayjs';
import { createHash } from 'crypto';
import { UserService } from '@/modules/user/user.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { RegisterDto, TokenResponse } from '@/modules/auth/dto/auth.dto';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { JwtPayload } from '@/common/interfaces/jwt.interface';
import { parseExpiresIn } from '@/common/utils/time.util';
import { TypedConfigService } from '@/config/typed-config.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UserService,
    private jwtService: JwtService,
    private config: TypedConfigService,
  ) {}

  /**
   * 使用账号（邮箱或用户名）和密码登录
   * @param account 用户账号（邮箱或用户名）
   * @param password 用户密码
   * @returns token 对
   */
  async loginWithCredentials(account: string, password: string): Promise<TokenResponse> {
    const user = await this.usersService.findByAccount(account);
    if (!user || !(await this.usersService.validatePassword(password, user.password))) {
      throw new BusinessException(BizCode.AUTH_INVALID_CREDENTIALS);
    }
    const { password: _, ...userWithoutPassword } = user;
    void _;
    return this.generateTokens(userWithoutPassword);
  }

  /**
   * 注册新用户
   * @param registerDto 注册信息
   * @returns token 对
   */
  async register(registerDto: RegisterDto): Promise<TokenResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BusinessException(BizCode.AUTH_EMAIL_ALREADY_REGISTERED);
    }

    const existingUsername = await this.usersService.findByUsername(registerDto.username);
    if (existingUsername) {
      throw new BusinessException(BizCode.AUTH_USERNAME_ALREADY_TAKEN);
    }

    const user = await this.usersService.create(registerDto);
    return this.generateTokens(user);
  }

  /**
   * 刷新 token
   * @param refreshToken 刷新 token
   * @returns 新的 access token 和 refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revoked || dayjs().isAfter(storedToken.expiresAt)) {
      throw new BusinessException(BizCode.AUTH_INVALID_REFRESH_TOKEN);
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const { password: _, ...user } = storedToken.user;
    void _;

    return this.generateTokens(user);
  }

  /**
   * 用户退出登录，撤销该用户的所有 refresh tokens
   * @param userId 用户 ID
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: { revoked: true },
    });
  }

  /**
   * 生成 access token 和 refresh token
   * @param user 用户信息
   * @returns 新生成的 token 对
   */
  private async generateTokens(user: { id: string }): Promise<TokenResponse> {
    const payload: JwtPayload = {
      sub: user.id,
    };

    const jwtSecret = this.config.get('jwt.secret');
    const jwtRefreshSecret = this.config.get('jwt.refreshSecret');
    const jwtExpiresIn = this.config.get('jwt.accessTokenTtl');
    const jwtRefreshExpiresIn = this.config.get('jwt.refreshTokenTtl');

    const accessTokenTtl = parseExpiresIn(jwtExpiresIn);
    const refreshTokenTtl = parseExpiresIn(jwtRefreshExpiresIn);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: accessTokenTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: refreshTokenTtl,
      }),
    ]);
    const expiresAt = dayjs().add(refreshTokenTtl, 'second').toDate();

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 对 refresh token 进行 SHA-256 哈希，用于安全存储
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
