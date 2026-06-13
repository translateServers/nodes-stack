import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UserModule } from '@/modules/user/user.module';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { TypedConfigService } from '@/config/typed-config.service';
import { parseExpiresIn } from '@/common/utils/time.util';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [],
      useFactory: (config: TypedConfigService) => {
        const jwtConfig = config.namespace('jwt');
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: parseExpiresIn(jwtConfig.accessTokenTtl),
          },
        };
      },
      inject: [TypedConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CaptchaService],
  exports: [AuthService],
})
export class AuthModule {}
