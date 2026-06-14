import { Controller, Post, Body, HttpCode, HttpStatus, Request, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import {
  CaptchaResponseDto,
  LoginDto,
  ProfileResponseDto,
  RefreshTokenDto,
  RegisterDto,
  TokenResponseDto,
} from '@/modules/auth/dto/auth.dto';
import { Public } from '@/common/decorators/public.decorator';
import { UserPayload } from '@/common/interfaces/user.interface';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';

type AuthenticatedRequest = ExpressRequest & {
  user: UserPayload;
};

@ApiTags('认证模块')
@ApiGlobalErrors()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Public()
  @Get('captcha')
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: '获取验证码',
    description: '生成一张SVG格式的验证码图片，返回验证码ID和图片内容。登录时需要携带此验证码ID。',
  })
  @ApiSuccessResponse(CaptchaResponseDto)
  getCaptcha(): CaptchaResponseDto {
    return this.captchaService.generateCaptcha();
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '用户注册',
    description:
      '注册新用户账号。需要提供邮箱、用户名和密码。注册成功后自动登录并返回访问令牌和刷新令牌。',
  })
  @ApiSuccessResponse(TokenResponseDto, { status: HttpStatus.CREATED })
  async register(@Body() registerDto: RegisterDto): Promise<TokenResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '用户登录',
    description:
      '使用账号（邮箱或用户名）和密码登录系统。需要提供验证码ID和验证码内容。登录成功后返回访问令牌和刷新令牌。',
  })
  @ApiSuccessResponse(TokenResponseDto)
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    await this.captchaService.verifyCaptcha(loginDto.captchaId, loginDto.captchaCode);
    return this.authService.loginWithCredentials(loginDto.account, loginDto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '刷新访问令牌',
    description:
      '使用刷新令牌获取新的访问令牌和刷新令牌。旧刷新令牌会立即失效。当访问令牌过期时，可使用此接口获取新令牌，无需重新登录。',
  })
  @ApiSuccessResponse(TokenResponseDto)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '退出登录',
    description:
      '退出当前账号，撤销该用户的所有刷新令牌。退出后需要使用刷新令牌重新获取访问令牌，或重新登录。',
  })
  @ApiSuccessNoDataResponse({ message: '退出成功' })
  async logout(@Request() req: AuthenticatedRequest): Promise<void> {
    return this.authService.logout(req.user.id);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '获取当前用户信息',
    description: '获取当前登录用户的详细信息（不包含密码）。',
  })
  @ApiSuccessResponse(ProfileResponseDto)
  async getProfile(@Request() req: AuthenticatedRequest): Promise<ProfileResponseDto> {
    return this.userService.findOne(req.user.id);
  }
}
