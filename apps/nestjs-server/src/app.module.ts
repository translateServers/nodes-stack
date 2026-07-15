import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserModule } from '@/modules/user/user.module';
import { MenuModule } from '@/modules/menu/menu.module';
import { RoleModule } from '@/modules/role/role.module';
import { DictModule } from '@/modules/dict/dict.module';
import { FileModule } from '@/modules/file/file.module';
import { HealthModule } from '@/modules/health/health.module';
import { CacheModule } from '@/modules/cache/cache.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { LoggerModule } from '@/modules/logger/logger.module';
import { AppConfigModule } from '@/config/config.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ThrottlerGuard as CustomThrottlerGuard } from '@/common/guards/throttler.guard';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    RedisModule,
    CacheModule,
    PrismaModule,
    AuthModule,
    UserModule,
    MenuModule,
    RoleModule,
    DictModule,
    FileModule,
    HealthModule,
    LoggerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
