import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { RedisService } from '@/modules/redis/redis.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: (redisService: RedisService) => ({
        // redis v6 与 @keyv/redis 内部的 @redis/client 类型路径不同，
        // 但运行时完全兼容，此处使用 as any 规避 pnpm 严格解析导致的类型不匹配。
        stores: [new KeyvRedis(redisService.client as never)],
        ttl: 30_000,
      }),
      inject: [RedisService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
